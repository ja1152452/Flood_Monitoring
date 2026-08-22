import bcrypt from 'bcrypt';
import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, paginate } from '../../utils/pagination.js';
import { writeAuditLog } from '../../middleware/audit.js';

const SAFE_FIELDS = 'id, email, role, full_name, phone_number, is_active, created_at';

export const getAll = async (queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);
  const { role, barangay, search } = queryParams;

  const conditions = [];
  const params     = [];
  let   i          = 1;

  if (role)     { conditions.push(`role::text = $${i++}`); params.push(role); }
  if (search)   {
    conditions.push(`(full_name ILIKE $${i} OR email ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ rows: data }, { rows: count }] = await Promise.all([
    query(
      `SELECT ${SAFE_FIELDS} FROM users ${where}
       ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM users ${where}`, params),
  ]);

  return paginate(data, parseInt(count[0].count, 10), { page, limit });
};

export const getById = async (id) => {
  const { rows } = await query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`, [id]
  );
  if (!rows.length) throw ApiError.notFound('User not found');
  return rows[0];
};

export const updateRole = async (id, role, actorId) => {
  const { rows: before } = await query('SELECT role FROM users WHERE id = $1', [id]);
  if (!before.length) throw ApiError.notFound('User not found');
  if (before[0].role === 'SUPER_ADMIN') throw ApiError.forbidden('Cannot modify super admin role');

  const { rows } = await query(
    `UPDATE users SET role = $2::user_role, updated_at = NOW()
     WHERE id = $1 RETURNING ${SAFE_FIELDS}`,
    [id, role]
  );

  await writeAuditLog({
    userId: actorId, action: 'USER_ROLE_CHANGED',
    entityType: 'users', entityId: id,
    before: { role: before[0].role }, after: { role },
  });

  return rows[0];
};

export const setActive = async (id, isActive, actorId) => {
  const { rows } = await query(
    `UPDATE users SET is_active = $2, updated_at = NOW()
     WHERE id = $1 RETURNING ${SAFE_FIELDS}`,
    [id, isActive]
  );
  if (!rows.length) throw ApiError.notFound('User not found');

  await writeAuditLog({
    userId: actorId, action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'users', entityId: id,
  });

  return rows[0];
};

export const resetPassword = async (id, newPassword, actorId) => {
  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
    [id, hash]
  );
  await writeAuditLog({
    userId: actorId, action: 'USER_PASSWORD_RESET',
    entityType: 'users', entityId: id,
  });
};