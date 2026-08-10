import { query } from '../config/db.js';

export const writeAuditLog = async ({ userId, action, entityType, entityId, before, after, ip }) => {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, before_state, after_state, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId     || null,
        action,
        entityType || null,
        entityId   || null,
        before     ? JSON.stringify(before) : null,
        after      ? JSON.stringify(after)  : null,
        ip         || null,
      ]
    );
  } catch (err) {
    console.error('[Audit] Failed to write log:', err.message);
  }
};