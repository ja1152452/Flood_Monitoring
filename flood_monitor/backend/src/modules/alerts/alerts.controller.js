import * as service from './alerts.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { query } from '../../config/db.js';
import { writeAuditLog } from '../../middleware/audit.js';

export const getActive = asyncHandler(async (_req, res) => {
  const data = await service.getActive();
  res.json({ success: true, data });
});

export const getHistory = asyncHandler(async (req, res) => {
  const data = await service.getHistory(req.query);
  res.json({ success: true, data });
});

export const resolve = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE flood_alerts
     SET is_active = FALSE, resolved_at = NOW(), resolved_by = $2, notes = $3
     WHERE id = $1 AND is_active = TRUE
     RETURNING *`,
    [req.params.id, req.user.id, req.body.notes || null]
  );
  if (!rows.length) throw ApiError.notFound('Active alert not found');

  await writeAuditLog({
    userId: req.user.id, action: 'ALERT_RESOLVED',
    entityType: 'flood_alerts', entityId: req.params.id,
    after: { resolved_by: req.user.id, notes: req.body.notes },
    ip: req.ip,
  });

  res.json({ success: true, data: rows[0] });
});

export const getDispatches = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM alert_dispatches WHERE alert_id = $1 ORDER BY dispatched_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
});