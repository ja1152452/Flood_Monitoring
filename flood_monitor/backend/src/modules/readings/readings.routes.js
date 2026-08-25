import { Router } from 'express';
import { authenticate, authenticateCamera } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { query } from '../../config/db.js';
import * as service from './readings.service.js';
import { streamService } from '../analytics/stream.service.js';
import Joi from 'joi';

const router = Router();

const ingestSchema = Joi.object({
  camera_code: Joi.string().required(),
  water_level_m: Joi.number().required(),
  flood_level: Joi.string().valid('NORMAL', 'MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL').required(),
  waterline_pixel_y: Joi.number().integer().optional(),
  confidence: Joi.number().min(0).max(1).optional(),
  captured_at: Joi.string().isoDate().optional(),
});

const ALL_ROLES = ['CITIZEN', 'RESCUE', 'ADMIN', 'SUPER_ADMIN', 'PNP', 'BFP', 'COAST_GUARD', 'RHU', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'MSWDO'];

router.get('/latest',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const data = await service.getLatest(null);
    res.json({ success: true, data });
  })
);

router.get('/rate-of-rise',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT water_level_m, captured_at
       FROM water_level_readings
       WHERE captured_at >= NOW() - INTERVAL '1 hour'
       ORDER BY captured_at ASC`
    );
    if (rows.length < 2) {
      return res.json({ success: true, data: { rate_per_hour: 0, trend: 'STABLE' } });
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    const hours = (new Date(last.captured_at) - new Date(first.captured_at)) / 3600000;
    const delta = parseFloat(last.water_level_m) - parseFloat(first.water_level_m);

    let rate = 0;
    if (hours > 0.001) {
      rate = parseFloat((delta / hours).toFixed(2));
      if (Math.abs(delta) < 0.01) rate = 0;
    }

    let trend = 'STABLE';
    if (rate > 0.02) trend = 'RISING';
    else if (rate < -0.02) trend = 'RECEDING';

    res.json({
      success: true,
      data: {
        rate_per_hour: rate,
        trend: trend,
        from_level: parseFloat(first.water_level_m),
        to_level: parseFloat(last.water_level_m),
        period_hours: parseFloat(hours.toFixed(2)),
      },
    });
  })
);

router.get('/trend',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT water_level_m, captured_at
       FROM water_level_readings
       WHERE captured_at >= NOW() - INTERVAL '1 hour'
       ORDER BY captured_at ASC
       LIMIT 20`
    );
    if (rows.length < 2) {
      return res.json({ success: true, data: { rate_per_hour: 0, trend: 'STABLE' } });
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    const hours = (new Date(last.captured_at) - new Date(first.captured_at)) / 3600000;
    const delta = parseFloat(last.water_level_m) - parseFloat(first.water_level_m);
    let rate = hours > 0 ? parseFloat((delta / hours).toFixed(3)) : 0;
    if (Math.abs(delta) < 0.01) rate = 0;
    res.json({
      success: true,
      data: {
        rate_per_hour: rate,
        trend: rate > 0.02 ? 'RISING' : rate < -0.02 ? 'RECEDING' : 'STABLE',
        latest_m: parseFloat(last.water_level_m),
      },
    });
  })
);

router.get('/live',
  authenticate,
  (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    streamService.addClient('readings-live', res);

    const heartbeat = setInterval(() => res.write(':ping\n\n'), 25000);
    req.on('close', () => clearInterval(heartbeat));
  }
);

router.post('/ingest',
  authenticateCamera,
  validate(ingestSchema),
  asyncHandler(async (req, res) => {
    const data = await service.ingestReading(null, req.body);
    streamService.broadcast('readings-live', 'reading', data);
    res.status(201).json({ success: true, data });
  })
);

router.get('/:cameraId/latest',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const data = await service.getLatest(req.params.cameraId);
    res.json({ success: true, data });
  })
);

router.get('/:cameraId/history',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const limit = Math.min(50000, parseInt(req.query.limit || '48', 10));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
    const conditions = ['camera_id = $1'];
    const params = [req.params.cameraId];
    let i = 2;

    const VALID_LEVELS = ['NORMAL', 'MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'];
    if (req.query.flood_level && VALID_LEVELS.includes(req.query.flood_level)) {
      conditions.push(`flood_level = $${i++}`);
      params.push(req.query.flood_level);
    }

    if (req.query.date) {
      conditions.push(`captured_at::date = $${i++}`);
      params.push(req.query.date);
    } else {
      if (req.query.from) { conditions.push(`captured_at >= $${i++}`); params.push(req.query.from); }
      if (req.query.to) { conditions.push(`captured_at <= $${i++}`); params.push(req.query.to); }
    }

    const where = conditions.join(' AND ');
    const { rows } = await query(
      `SELECT * FROM water_level_readings
       WHERE ${where}
       ORDER BY captured_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    res.json({ success: true, data: rows });
  })
);

router.get('/:cameraId/trend',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT water_level_m, captured_at, flood_level
       FROM water_level_readings
       WHERE camera_id = $1
       ORDER BY captured_at DESC
       LIMIT 5`,
      [req.params.cameraId]
    );

    if (rows.length < 2) {
      return res.json({ success: true, data: { trend: 'STABLE', delta_m: 0 } });
    }

    const latest = parseFloat(rows[0].water_level_m);
    const previous = parseFloat(rows[rows.length - 1].water_level_m);
    const delta = parseFloat((latest - previous).toFixed(3));
    const trend = delta > 0.02 ? 'RISING' : delta < -0.02 ? 'FALLING' : 'STABLE';

    res.json({ success: true, data: { trend, delta_m: delta, latest, previous } });
  })
);

router.get('/:cameraId/rate-of-rise',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT water_level_m, captured_at
       FROM water_level_readings
       WHERE camera_id = $1
         AND captured_at >= NOW() - INTERVAL '1 hour'
       ORDER BY captured_at ASC`,
      [req.params.cameraId]
    );

    if (rows.length < 2) {
      return res.json({ success: true, data: { rate_per_hour: 0, trend: 'STABLE' } });
    }

    const first = rows[0];
    const last = rows[rows.length - 1];
    const hours = (new Date(last.captured_at) - new Date(first.captured_at)) / 3600000;
    const delta = parseFloat(last.water_level_m) - parseFloat(first.water_level_m);

    let rate = 0;
    if (hours > 0.001) {
      rate = parseFloat((delta / hours).toFixed(2));
      if (Math.abs(delta) < 0.01) rate = 0;
    }

    let trend = 'STABLE';
    if (rate > 0.02) trend = 'RISING';
    else if (rate < -0.02) trend = 'RECEDING';

    res.json({
      success: true,
      data: {
        rate_per_hour: rate,
        trend: trend,
        from_level: parseFloat(first.water_level_m),
        to_level: parseFloat(last.water_level_m),
        period_hours: parseFloat(hours.toFixed(2)),
      },
    });
  })
);

export default router;