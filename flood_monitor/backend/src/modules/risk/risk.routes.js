import { Router } from 'express';
import { query } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import Joi from 'joi';
import { validate } from '../../middleware/validate.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { streamService } from '../analytics/stream.service.js';

const router = Router();
router.use(authenticate);

const schema = Joi.object({
  name:       Joi.string().max(255).required(),
  risk_level: Joi.string().valid('NORMAL','MONITOR','ALERT','EVACUATION','CRITICAL','VERY_HIGH','HIGH','MODERATE','LOW').required(),
  lat:        Joi.number().min(-90).max(90).required(),
  lng:        Joi.number().min(-180).max(180).required(),
  radius:     Joi.number().integer().min(50).max(2000).optional(),
  note:       Joi.string().max(500).optional().allow('', null),
});

router.get('/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT * FROM flood_risk_areas
       WHERE is_active = TRUE
       ORDER BY
         CASE risk_level
           WHEN 'VERY_HIGH' THEN 1
           WHEN 'HIGH'      THEN 2
           WHEN 'MODERATE'  THEN 3
           WHEN 'LOW'       THEN 4
           ELSE 5
         END, name`
    );
    res.json({ success: true, data: rows });
  })
);

router.post('/',
  authorize('ADMIN','SUPER_ADMIN'),
  validate(schema),
  asyncHandler(async (req, res) => {
    const { name, risk_level, lat, lng, radius, note } = req.body;
    const { rows } = await query(
      `INSERT INTO flood_risk_areas (name, risk_level, lat, lng, radius, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, risk_level, lat, lng, radius || 250, note || null]
    );
    await writeAuditLog({
      userId: req.user.id, action: 'RISK_AREA_CREATED',
      entityType: 'flood_risk_areas', entityId: rows[0].id,
      after: rows[0],
    });
    streamService.broadcastAll('risk-areas-updated', { action: 'created', data: rows[0] });
    res.status(201).json({ success: true, data: rows[0] });
  })
);

router.patch('/:id',
  authorize('ADMIN','SUPER_ADMIN'),
  validate(schema.fork(Object.keys(schema.describe().keys), f => f.optional())),
  asyncHandler(async (req, res) => {
    const fields = Object.keys(req.body);
    if (!fields.length) throw ApiError.badRequest('No fields to update');
    const vals  = Object.values(req.body);
    const set   = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const { rows } = await query(
      `UPDATE flood_risk_areas SET ${set}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, ...vals]
    );
    if (!rows.length) throw ApiError.notFound('Risk area not found');
    streamService.broadcastAll('risk-areas-updated', { action: 'updated', data: rows[0] });
    res.json({ success: true, data: rows[0] });
  })
);

router.delete('/:id',
  authorize('ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE flood_risk_areas SET is_active = FALSE WHERE id = $1`,
      [req.params.id]
    );
    await writeAuditLog({
      userId: req.user.id, action: 'RISK_AREA_DELETED',
      entityType: 'flood_risk_areas', entityId: req.params.id,
    });
    streamService.broadcastAll('risk-areas-updated', { action: 'deleted', id: req.params.id });
    res.json({ success: true, message: 'Deleted' });
  })
);

export default router;