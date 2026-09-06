import { query } from '../config/db.js';

export const writeAuditLog = async ({ userId, action, entityType, entityId, description, before, after, ip, userAgent }) => {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, description, before_state, after_state, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        userId     || null,
        action,
        entityType || null,
        entityId   || null,
        description|| null,
        before     ? (typeof before === 'string' ? before : JSON.stringify(before)) : null,
        after      ? (typeof after === 'string' ? after : JSON.stringify(after))   : null,
        ip         || null,
        userAgent  || null,
      ]
    );
  } catch (err) {
    console.error('[Audit] Failed to write log:', err.message);
  }
};