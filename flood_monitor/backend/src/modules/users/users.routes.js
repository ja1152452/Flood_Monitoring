import { Router } from 'express';
import { query, withTransaction } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { getIO } from '../../config/socket.js';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import { validate } from '../../middleware/validate.js';

const router = Router();

// Responder updates their own location (no admin required)
router.post('/location', authenticate, asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) throw ApiError.badRequest('lat and lng required');

  await query(
    `UPDATE users SET last_lat = $2, last_lng = $3, last_location_at = NOW() WHERE id = $1`,
    [req.user.id, lat, lng]
  );

  const io = getIO();
  if (io) {
    io.emit('responder:location', {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      last_lat: lat,
      last_lng: lng,
      last_location_at: new Date().toISOString(),
    });
  }

  res.json({ success: true });
}));

// Admin gets all active responder locations & status — accessible by any authenticated user
router.get('/responder-locations', authenticate, asyncHandler(async (req, res) => {
  const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE', 'ADMIN', 'SUPER_ADMIN'];
  const { role, status } = req.query;

  let queryText = `SELECT id, full_name, role, phone_number, last_lat, last_lng, last_location_at,
            COALESCE(responder_status, 'AVAILABLE') AS responder_status
     FROM users
     WHERE role::text = ANY($1::text[]) 
       AND is_active = TRUE
       AND last_lat IS NOT NULL 
       AND last_lng IS NOT NULL`;
  const params = [RESPONDER_ROLES];

  if (role) {
    params.push(role);
    queryText += ` AND role::text = $${params.length}`;
  }
  if (status) {
    params.push(status);
    queryText += ` AND COALESCE(responder_status, 'AVAILABLE') = $${params.length}`;
  }

  const { rows } = await query(queryText, params);
  res.json({ success: true, data: rows });
}));

// Responder updates their duty status (AVAILABLE / OFF_DUTY)
router.patch('/responder-status', authenticate, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['AVAILABLE', 'OFF_DUTY'].includes(status)) {
    throw ApiError.badRequest('Invalid status. Must be AVAILABLE or OFF_DUTY');
  }
  await query(
    `UPDATE users SET responder_status = $2 WHERE id = $1`,
    [req.user.id, status]
  );
  const io = getIO();
  if (io) {
    io.emit('responder:status', { id: req.user.id, status });
  }
  res.json({ success: true, data: { status } });
}));

// Get location of a specific responder by user ID (for citizen tracking)
router.get('/responder-locations/:userId', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, full_name, role, phone_number, last_lat, last_lng, last_location_at,
            COALESCE(responder_status, 'AVAILABLE') AS responder_status
     FROM users
     WHERE id = $1`,
    [req.params.userId]
  );
  res.json({ success: true, data: rows[0] || null });
}));

// All routes below require ADMIN or SUPER_ADMIN
router.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'];

const createSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  full_name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s.'-]+$/).required().messages({
    'string.pattern.base': 'Full name must contain alphabetic letters and valid text symbols only',
  }),
  role: Joi.string().valid('ADMIN', 'PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'SUPER_ADMIN', 'MSWDO', 'CITIZEN', 'RESCUE').required(),
  barangay: Joi.string().max(100).optional().allow('', null),
  phone_number: Joi.string().pattern(/^09\d{9}$/).optional().allow('', null).messages({
    'string.pattern.base': 'Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)',
  }),
  evacuation_center_id: Joi.string().allow('', null).optional(),
  created_at: Joi.date().optional().allow('', null),
});

const updateSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s.'-]+$/).optional().messages({
    'string.pattern.base': 'Full name must contain alphabetic letters and valid text symbols only',
  }),
  role: Joi.string().valid('ADMIN', 'PNP', 'BFP', 'RHU', 'COAST_GUARD', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'SUPER_ADMIN', 'MSWDO', 'CITIZEN', 'RESCUE').optional(),
  barangay: Joi.string().max(100).optional().allow('', null),
  phone_number: Joi.string().pattern(/^09\d{9}$/).optional().allow('', null).messages({
    'string.pattern.base': 'Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)',
  }),
  is_active: Joi.boolean().optional(),
  password: Joi.string().min(8).optional(),
  evacuation_center_id: Joi.string().allow('', null).optional(),
  created_at: Joi.date().optional().allow('', null),
}).min(1);

router.get('/', asyncHandler(async (req, res) => {
  const role = req.query.role || null;
  const barangay = req.query.barangay || null;
  const search = req.query.search || null;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  let where = ['1=1'];
  const params = [];
  let pi = 1;

  if (role) {
    where.push(`u.role::text = $${pi++}`);
    params.push(role);
  }
  if (search) {
    where.push(`(u.email ILIKE $${pi} OR u.full_name ILIKE $${pi})`);
    params.push(`%${search}%`); pi++;
  }
  if (barangay) {
    where.push(`u.barangay_id IN (SELECT id FROM barangays WHERE name ILIKE $${pi++})`);
    params.push(`%${barangay}%`);
  }

  const whereStr = where.join(' AND ');

  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM users u WHERE ${whereStr}`,
    params
  );

  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.phone_number,
            u.is_active, u.created_at, u.barangay_id, u.evacuation_center_id,
            b.name AS barangay_name,
            ec.name AS evacuation_center_name
     FROM users u
     LEFT JOIN barangays b ON b.id = u.barangay_id
     LEFT JOIN evacuation_centers ec ON ec.id = u.evacuation_center_id
     WHERE ${whereStr}
     ORDER BY u.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: rows,
    meta: {
      total: parseInt(countRows[0].count),
      page,
      limit,
      pages: Math.ceil(parseInt(countRows[0].count) / limit),
    },
  });
}));

router.get('/stats', asyncHandler(async (_req, res) => {
  const [byRole, byBarangay, sosStats, sosByBarangay, sosTimeline] = await Promise.all([
    query(`
      SELECT role, COUNT(*) AS count, COUNT(*) FILTER (WHERE is_active) AS active
      FROM users GROUP BY role ORDER BY count DESC
    `),
    query(`
      SELECT b.name AS barangay, b.risk_level,
             COUNT(u.id) AS total_users,
             COUNT(u.id) FILTER (WHERE u.role = 'RESCUE') AS rescuers,
             COUNT(u.id) FILTER (WHERE u.role = 'CITIZEN') AS residents
      FROM barangays b
      LEFT JOIN users u ON u.barangay_id = b.id
      GROUP BY b.id, b.name, b.risk_level
      ORDER BY total_users DESC
    `),
    query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'PENDING')    AS pending,
        COUNT(*) FILTER (WHERE status = 'RESPONDING') AS responding,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')   AS resolved,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')  AS cancelled,
        ROUND(AVG(EXTRACT(EPOCH FROM (responded_at - created_at))/60) FILTER (WHERE responded_at IS NOT NULL), 1) AS avg_response_min
      FROM sos_requests
    `),
    query(`
      SELECT b.name AS barangay, b.risk_level,
             COUNT(s.id) AS total_sos,
             COUNT(s.id) FILTER (WHERE s.status = 'RESOLVED') AS resolved
      FROM barangays b
      LEFT JOIN sos_requests s ON s.barangay_id = b.id
      GROUP BY b.id, b.name, b.risk_level
      ORDER BY total_sos DESC
      LIMIT 10
    `),
    query(`
      SELECT DATE(created_at AT TIME ZONE 'Asia/Manila') AS date,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved
      FROM sos_requests
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY date ORDER BY date ASC
    `),
  ]);

  res.json({
    success: true,
    data: {
      by_role: byRole.rows,
      by_barangay: byBarangay.rows,
      sos_stats: sosStats.rows[0],
      sos_barangay: sosByBarangay.rows,
      sos_timeline: sosTimeline.rows,
    },
  });
}));

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const { email, password, full_name, role, barangay, phone_number, evacuation_center_id, created_at } = req.body;

  // Only Super Admins can create Administrator accounts
  if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && req.user.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only Super Admins can create Administrator accounts');
  }

  console.log('[POST /users] Creating user with role:', role);

  const { rows: existing } = await query(
    'SELECT id FROM users WHERE email = $1', [email.toLowerCase()]
  );
  if (existing.length) throw ApiError.conflict('Email already registered');

  const hash = await bcrypt.hash(password, 12);

  let barangayId = null;
  if (barangay?.trim()) {
    const { rows: brgy } = await query(
      'SELECT id FROM barangays WHERE name ILIKE $1 LIMIT 1', [barangay.trim()]
    );
    if (brgy.length) barangayId = brgy[0].id;
  }

  const centerId = (role === 'MSWDO' && evacuation_center_id?.trim()) ? evacuation_center_id : null;

  let customCreatedAt = null;
  if (created_at) {
    const d = new Date(created_at);
    if (!isNaN(d.getTime())) {
      customCreatedAt = d.toISOString();
    }
  }

  try {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name, role, barangay_id, phone_number, evacuation_center_id, created_at, is_active, email_verified)
       VALUES ($1,$2,$3,$4::user_role,$5,$6,$7, COALESCE($8::timestamptz, NOW()), true, true)
       RETURNING id, email, full_name, role, is_active, created_at, barangay_id`,
      [email.toLowerCase(), hash, full_name, role, barangayId, phone_number || null, centerId, customCreatedAt]
    );

    await writeAuditLog({
      userId: req.user.id, action: 'USER_CREATED',
      entityType: 'users', entityId: rows[0].id,
      after: { email, role, barangay, evacuation_center_id: centerId, created_at: rows[0].created_at },
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[POST /users] Database error:', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      role: role,
    });
    if (err.code === '22P02') {
      throw ApiError.badRequest(`Invalid role: ${role}. Must be one of: ADMIN, PNP, BFP, COAST_GUARD, RHU, MDRRMO, MDRRMO_RESPONDER, BARANGAY_OFFICIAL, SUPER_ADMIN, MSWDO, CITIZEN, RESCUE`);
    }
    throw err;
  }
}));

// IMPORTANT: /:id/permanent must be before /:id to avoid route conflict
router.delete('/:id/permanent', asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    throw ApiError.forbidden('Cannot delete your own account');
  }
  const { rows } = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (!rows.length) throw ApiError.notFound('User not found');
  if (rows[0].role === 'SUPER_ADMIN') throw ApiError.forbidden('Cannot delete a Super Admin');
  if (rows[0].role === 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only Super Admins can delete Administrator accounts');
  }

  const targetId = req.params.id;

  await withTransaction(async (client) => {
    // 1. Unlink foreign key references to this user
    await client.query('UPDATE backup_requests SET assigned_responder_id = NULL WHERE assigned_responder_id = $1', [targetId]);
    await client.query('UPDATE sos_requests SET assigned_rescue_id = NULL WHERE assigned_rescue_id = $1', [targetId]);
    await client.query('UPDATE sos_requests SET dispatched_by = NULL WHERE dispatched_by = $1', [targetId]);
    await client.query('UPDATE sos_dispatches SET dispatched_by = NULL WHERE dispatched_by = $1', [targetId]);
    await client.query('UPDATE flood_alerts SET resolved_by = NULL WHERE resolved_by = $1', [targetId]);
    await client.query('UPDATE evacuation_centers SET updated_by = NULL WHERE updated_by = $1', [targetId]);
    await client.query('UPDATE evacuation_families SET created_by = NULL WHERE created_by = $1', [targetId]);
    await client.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [targetId]);

    // 2. Cascade delete dependent user-owned records
    await client.query('DELETE FROM sos_dispatches WHERE responder_id = $1', [targetId]);
    await client.query('DELETE FROM backup_requests WHERE requester_id = $1', [targetId]);
    await client.query('DELETE FROM announcements WHERE created_by = $1', [targetId]);
    await client.query('DELETE FROM sos_requests WHERE user_id = $1', [targetId]);

    // 3. Delete user row
    await client.query('DELETE FROM users WHERE id = $1', [targetId]);
  });

  await writeAuditLog({
    userId: req.user.id, action: 'USER_DELETED',
    entityType: 'users', entityId: targetId,
  });

  res.json({ success: true, message: 'User permanently deleted' });
}));

router.patch('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  const { password, barangay, evacuation_center_id, created_at, ...rest } = req.body;

  if (req.params.id === req.user.id && rest.role) {
    throw ApiError.forbidden('Cannot change your own role');
  }

  const { rows: targetUser } = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (!targetUser.length) throw ApiError.notFound('User not found');

  // Guard Administrator accounts: Only Super Admins can modify Admins or promote to Admin
  if (targetUser[0].role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only Super Admins can modify Super Admin accounts');
  }
  if (targetUser[0].role === 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only Super Admins can modify Administrator accounts');
  }
  if ((rest.role === 'ADMIN' || rest.role === 'SUPER_ADMIN') && req.user.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only Super Admins can promote users to Administrator roles');
  }

  const updates = { ...rest };

  if (password) {
    updates.password_hash = await bcrypt.hash(password, 12);
  }

  if (barangay !== undefined) {
    if (barangay) {
      const { rows: brgy } = await query(
        'SELECT id FROM barangays WHERE name ILIKE $1 LIMIT 1', [barangay]
      );
      updates.barangay_id = brgy[0]?.id || null;
    } else {
      updates.barangay_id = null;
    }
  }

  if (evacuation_center_id !== undefined) {
    updates.evacuation_center_id = evacuation_center_id || null;
  }

  if (created_at !== undefined) {
    if (created_at) {
      const d = new Date(created_at);
      if (!isNaN(d.getTime())) {
        updates.created_at = d.toISOString();
      }
    }
  }

  const fields = Object.keys(updates);
  if (!fields.length) throw ApiError.badRequest('Nothing to update');

  const set = fields.map((f, i) => f === 'role' ? `${f} = $${i + 2}::user_role` : `${f} = $${i + 2}`).join(', ');
  const values = Object.values(updates);

  const { rows } = await query(
    `UPDATE users SET ${set}, updated_at = NOW()
     WHERE id = $1 RETURNING id, email, full_name, role, is_active, created_at`,
    [req.params.id, ...values]
  );
  if (!rows.length) throw ApiError.notFound('User not found');

  await writeAuditLog({
    userId: req.user.id, action: 'USER_UPDATED',
    entityType: 'users', entityId: req.params.id,
    after: rest,
  });

  res.json({ success: true, data: rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    throw ApiError.forbidden('Cannot deactivate your own account');
  }

  const { rows: targetUser } = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (!targetUser.length) throw ApiError.notFound('User not found');

  if (targetUser[0].role === 'SUPER_ADMIN') {
    throw ApiError.forbidden('Cannot deactivate a Super Admin');
  }
  if (targetUser[0].role === 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only Super Admins can deactivate Administrator accounts');
  }

  await query(
    'UPDATE users SET is_active = FALSE WHERE id = $1', [req.params.id]
  );
  await writeAuditLog({
    userId: req.user.id, action: 'USER_DEACTIVATED',
    entityType: 'users', entityId: req.params.id,
  });
  res.json({ success: true, message: 'User deactivated' });
}));

export default router;
