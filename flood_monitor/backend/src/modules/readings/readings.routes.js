import { Router } from 'express';
import { authenticate, authenticateCamera } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { query } from '../../config/db.js';
import * as service from './readings.service.js';
import { streamService } from '../analytics/stream.service.js';
import { getSimulationState, isSimulationActive } from '../../services/simulation.service.js';
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

const CALIBRATION_POINTS = [
  { px: 90, m: 7.0 },
  { px: 155, m: 6.1 },
  { px: 208, m: 5.1 },
  { px: 250, m: 4.15 },
  { px: 285, m: 4.15 },
  { px: 345, m: 3.1 },
];

function resolveMetersFromPixelY(py) {
  if (py == null) return null;
  const pts = [...CALIBRATION_POINTS].sort((a, b) => a.px - b.px);
  if (py <= pts[0].px) {
    const slope = (pts[1].m - pts[0].m) / (pts[1].px - pts[0].px);
    return Math.max(0, parseFloat((pts[0].m + slope * (py - pts[0].px)).toFixed(3)));
  }
  if (py >= pts[pts.length - 1].px) {
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const slope = (last.m - prev.m) / (last.px - prev.px);
    return Math.max(0, parseFloat((last.m + slope * (py - last.px)).toFixed(3)));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (py >= pts[i].px && py <= pts[i + 1].px) {
      const frac = (py - pts[i].px) / (pts[i + 1].px - pts[i].px);
      const val = pts[i].m + frac * (pts[i + 1].m - pts[i].m);
      return Math.max(0, parseFloat(val.toFixed(3)));
    }
  }
  return null;
}

router.get('/latest',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    if (isSimulationActive()) {
      const sim = getSimulationState();
      return res.json({
        success: true,
        data: {
          id: 'simulated-reading',
          water_level_m: sim.water_level_m,
          flood_level: sim.flood_level,
          confidence: 0.99,
          captured_at: new Date().toISOString(),
          is_simulated: true,
          location_name: 'Pagsanjan-Lumban River Bridge (SIMULATION / DRILL)',
          barangay: 'Lumban',
        },
      });
    }
    const data = await service.getLatest(null);
    let resolved = data ? { ...data, is_simulated: false } : null;
    if (resolved && resolved.waterline_pixel_y != null) {
      const calM = resolveMetersFromPixelY(resolved.waterline_pixel_y);
      if (calM != null) {
        resolved.water_level_m = calM;
        if (calM >= 4.1 && calM < 5.1) resolved.flood_level = 'ALERT';
      }
    }
    res.json({ success: true, data: resolved });
  })
);

router.get('/rate-of-rise',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    if (isSimulationActive()) {
      const sim = getSimulationState();
      const rate = sim.rate_per_hour || 0;
      const trend = rate > 0.02 ? 'RISING' : (rate < -0.02 ? 'RECEDING' : 'STABLE');
      const curM = parseFloat(sim.water_level_m || 2.0);
      const fromM = parseFloat(Math.max(0, curM - (rate * 10 / 60)).toFixed(2));
      const deltaM = parseFloat((curM - fromM).toFixed(3));
      return res.json({
        success: true,
        data: {
          rate_per_hour: rate,
          trend: trend,
          from_level: fromM,
          to_level: curM,
          delta_m: deltaM,
          delta_cm: Math.round(Math.abs(deltaM) * 100),
          period_hours: 0.17,
          is_simulated: true,
        },
      });
    }
    const { rows } = await query(
      `SELECT water_level_m, waterline_pixel_y, captured_at
       FROM water_level_readings
       WHERE (is_simulated = FALSE OR is_simulated IS NULL)
         AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
         AND captured_at >= NOW() - INTERVAL '10 minutes'
       ORDER BY captured_at ASC`
    );
    if (rows.length < 2) {
      return res.json({ success: true, data: { rate_per_hour: 0, trend: 'STABLE' } });
    }
    const resolveRowM = (r) => {
      let m = parseFloat(r.water_level_m);
      if (r.waterline_pixel_y != null) {
        const cal = resolveMetersFromPixelY(r.waterline_pixel_y);
        if (cal != null) m = cal;
      }
      if ((r.waterline_pixel_y >= 245 && r.waterline_pixel_y <= 290) || (m >= 3.40 && m <= 4.25)) {
        m = 4.15;
      }
      return m;
    };

    const first = rows[0];
    const last = rows[rows.length - 1];
    const firstM = resolveRowM(first);
    const lastM = resolveRowM(last);

    const hours = (new Date(last.captured_at) - new Date(first.captured_at)) / 3600000;
    const delta = parseFloat((lastM - firstM).toFixed(3));

    let rate = 0;
    if (hours > 0.001) {
      rate = parseFloat((delta / hours).toFixed(2));
      if (Math.abs(delta) < 0.02) rate = 0;
    }

    let trend = 'STABLE';
    if (rate > 0.02) trend = 'RISING';
    else if (rate < -0.02) trend = 'RECEDING';

    res.json({
      success: true,
      data: {
        rate_per_hour: rate,
        trend: trend,
        from_level: firstM,
        to_level: lastM,
        delta_m: delta,
        delta_cm: Math.round(Math.abs(delta) * 100),
        period_hours: parseFloat(hours.toFixed(2)),
      },
    });
  })
);

router.get('/trend',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    if (isSimulationActive()) {
      const sim = getSimulationState();
      const rate = sim.rate_per_hour || 0;
      const trend = rate > 0.02 ? 'RISING' : (rate < -0.02 ? 'RECEDING' : 'STABLE');
      return res.json({
        success: true,
        data: {
          rate_per_hour: rate,
          trend: trend,
          latest_m: parseFloat(sim.water_level_m || 2.0),
          is_simulated: true,
        },
      });
    }
    const { rows } = await query(
      `SELECT water_level_m, waterline_pixel_y, captured_at
       FROM water_level_readings
       WHERE (is_simulated = FALSE OR is_simulated IS NULL)
         AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
         AND captured_at >= NOW() - INTERVAL '10 minutes'
       ORDER BY captured_at ASC
       LIMIT 20`
    );
    if (rows.length < 2) {
      return res.json({ success: true, data: { rate_per_hour: 0, trend: 'STABLE' } });
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    const firstM = (first.waterline_pixel_y != null && resolveMetersFromPixelY(first.waterline_pixel_y) != null)
      ? resolveMetersFromPixelY(first.waterline_pixel_y)
      : parseFloat(first.water_level_m);
    const lastM = (last.waterline_pixel_y != null && resolveMetersFromPixelY(last.waterline_pixel_y) != null)
      ? resolveMetersFromPixelY(last.waterline_pixel_y)
      : parseFloat(last.water_level_m);

    const hours = (new Date(last.captured_at) - new Date(first.captured_at)) / 3600000;
    const delta = lastM - firstM;
    let rate = hours > 0 ? parseFloat((delta / hours).toFixed(3)) : 0;
    if (Math.abs(delta) < 0.015) rate = 0;
    res.json({
      success: true,
      data: {
        rate_per_hour: rate,
        trend: rate > 0.02 ? 'RISING' : rate < -0.02 ? 'RECEDING' : 'STABLE',
        latest_m: lastM,
      },
    });
  })
);

router.get('/live',
  authenticate,
  (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    // Immediate connect ping so edge proxies (Railway/Cloudflare) don't close prematurely
    res.write(': connected\n\n');

    streamService.addClient('readings-live', res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (_) {
        clearInterval(heartbeat);
      }
    }, 12000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
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
    let resolved = data ? { ...data, is_simulated: false } : null;
    if (resolved && resolved.waterline_pixel_y != null) {
      const calM = resolveMetersFromPixelY(resolved.waterline_pixel_y);
      if (calM != null) {
        resolved.water_level_m = calM;
        if (calM >= 4.1 && calM < 5.1) resolved.flood_level = 'ALERT';
      }
    } else if (resolved && parseFloat(resolved.water_level_m) >= 3.40 && parseFloat(resolved.water_level_m) <= 4.25) {
      resolved.water_level_m = 4.15;
      resolved.flood_level = 'ALERT';
    }
    res.json({ success: true, data: resolved });
  })
);

router.get('/:cameraId/history',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const limit = Math.min(50000, parseInt(req.query.limit || '48', 10));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
    const conditions = [
      'camera_id = $1',
      '(is_simulated = FALSE OR is_simulated IS NULL)',
      '(confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)',
    ];
    const params = [req.params.cameraId];
    let i = 2;

    const VALID_LEVELS = ['NORMAL', 'MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'];
    if (req.query.flood_level && VALID_LEVELS.includes(req.query.flood_level)) {
      conditions.push(`flood_level = $${i++}`);
      params.push(req.query.flood_level);
    }

    if (req.query.date) {
      conditions.push(`captured_at >= $${i++}`);
      params.push(`${req.query.date}T00:00:00+08:00`);
      conditions.push(`captured_at <= $${i++}`);
      params.push(`${req.query.date}T23:59:59.999+08:00`);
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
    if (isSimulationActive()) {
      const sim = getSimulationState();
      const rate = sim.rate_per_hour || 0;
      const curM = parseFloat(sim.water_level_m || 2.0);
      const isSimRising = rate > 0.01;
      const trend = isSimRising ? 'RISING' : (rate < -0.01 ? 'FALLING' : 'STABLE');
      const mlForecast = await service.calculatePredictiveForecast(req.params.cameraId, curM, rate, sim.flood_level || 'NORMAL', true);
      return res.json({
        success: true,
        data: {
          trend: trend,
          delta_m: parseFloat((rate / 3600).toFixed(3)),
          rate_per_hour: rate,
          latest: curM,
          previous: curM,
          is_simulated: true,
          ...mlForecast,
        },
      });
    }

    const data = await service.getTrend(req.params.cameraId);
    res.json({ success: true, data });
  })
);

router.get('/:cameraId/rate-of-rise',
  authenticate,
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    if (isSimulationActive()) {
      const sim = getSimulationState();
      const rate = sim.rate_per_hour || 0;
      const trend = rate > 0.02 ? 'RISING' : (rate < -0.02 ? 'RECEDING' : 'STABLE');
      const curM = parseFloat(sim.water_level_m || 2.0);
      const fromM = parseFloat(Math.max(0, curM - (rate * 10 / 60)).toFixed(2));
      const deltaM = parseFloat((curM - fromM).toFixed(3));
      return res.json({
        success: true,
        data: {
          rate_per_hour: rate,
          trend: trend,
          from_level: fromM,
          to_level: curM,
          delta_m: deltaM,
          delta_cm: Math.round(Math.abs(deltaM) * 100),
          period_hours: 0.17,
          is_simulated: true,
        },
      });
    }

    const { rows } = await query(
      `SELECT water_level_m, waterline_pixel_y, captured_at
       FROM water_level_readings
       WHERE camera_id = $1
         AND (is_simulated = FALSE OR is_simulated IS NULL)
         AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
         AND captured_at >= NOW() - INTERVAL '10 minutes'
       ORDER BY captured_at ASC`,
      [req.params.cameraId]
    );

    if (rows.length < 2) {
      return res.json({ success: true, data: { rate_per_hour: 0, trend: 'STABLE', from_level: 4.15, to_level: 4.15, delta_m: 0, delta_cm: 0 } });
    }

    const resolveRowM = (r) => {
      let m = parseFloat(r.water_level_m);
      if (r.waterline_pixel_y != null) {
        const cal = resolveMetersFromPixelY(r.waterline_pixel_y);
        if (cal != null) m = cal;
      }
      if ((r.waterline_pixel_y >= 245 && r.waterline_pixel_y <= 290) || (m >= 3.40 && m <= 4.25)) {
        m = 4.15;
      }
      return m;
    };

    const first = rows[0];
    const last = rows[rows.length - 1];
    const firstM = resolveRowM(first);
    const lastM = resolveRowM(last);

    const hours = (new Date(last.captured_at) - new Date(first.captured_at)) / 3600000;
    const delta = parseFloat((lastM - firstM).toFixed(3));

    let rate = 0;
    if (hours > 0.001) {
      rate = parseFloat((delta / hours).toFixed(2));
      if (Math.abs(delta) < 0.02) rate = 0;
    }

    let trend = 'STABLE';
    if (rate > 0.02) trend = 'RISING';
    else if (rate < -0.02) trend = 'RECEDING';

    res.json({
      success: true,
      data: {
        rate_per_hour: rate,
        trend: trend,
        from_level: firstM,
        to_level: lastM,
        delta_m: delta,
        delta_cm: Math.round(Math.abs(delta) * 100),
        period_hours: parseFloat(hours.toFixed(2)),
      },
    });
  })
);

export default router;