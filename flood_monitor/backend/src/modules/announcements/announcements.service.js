import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { sendPushNotification } from '../../services/firebase.js';

export const create = async (userId, dto) => {
  const { rows } = await query(
    `INSERT INTO announcements
       (created_by, title, message, type, target_roles, target_barangays, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      userId, dto.title, dto.message, dto.type || 'GENERAL',
      dto.target_roles || ['RESCUE', 'CITIZEN'],
      dto.target_barangays || null,
      dto.expires_at || null,
    ]
  );

  await writeAuditLog({
    userId, action: 'ANNOUNCEMENT_CREATED',
    entityType: 'announcements', entityId: rows[0].id,
    after: { title: dto.title, type: dto.type },
  });

  // send FCM push to all users with fcm_token
  try {
    const targetRoles = dto.target_roles || ['RESCUE', 'CITIZEN'];
    const { rows: recipients } = await query(
      `SELECT fcm_token FROM users
       WHERE role::text = ANY($1::text[]) AND is_active = TRUE AND fcm_token IS NOT NULL`,
      [targetRoles]
    );
    const TYPE_ICON = {
      FLOOD_WARNING: '⚠️', EVACUATION_ORDER: '🚨', ALL_CLEAR: '✅', GENERAL: '📢',
    };
    const icon = TYPE_ICON[dto.type] || '📢';
    for (const user of recipients) {
      sendPushNotification(user.fcm_token, `${icon} ${dto.title}`, dto.message).catch(() => {});
    }
  } catch (notifErr) {
    console.error('[createAnnouncement] Notification dispatch error (non-fatal):', notifErr.message);
  }

  return rows[0];
};

export const getActive = async () => {
  const { rows } = await query(
    `SELECT a.*, u.full_name AS created_by_name
     FROM announcements a
     JOIN users u ON u.id = a.created_by
     WHERE a.is_active = TRUE
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
     ORDER BY a.created_at DESC`
  );
  return rows;
};

export const getAll = async () => {
  const { rows } = await query(
    `SELECT a.*, u.full_name AS created_by_name
     FROM announcements a
     JOIN users u ON u.id = a.created_by
     ORDER BY a.created_at DESC
     LIMIT 100`
  );
  return rows;
};

export const deactivate = async (id, userId) => {
  const { rows } = await query(
    `UPDATE announcements SET is_active = FALSE
     WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!rows.length) throw ApiError.notFound('Announcement not found');

  await writeAuditLog({
    userId, action: 'ANNOUNCEMENT_DEACTIVATED',
    entityType: 'announcements', entityId: id,
  });

  return rows[0];
};