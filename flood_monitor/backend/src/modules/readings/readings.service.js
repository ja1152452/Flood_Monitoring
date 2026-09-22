import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, paginate } from '../../utils/pagination.js';
import { getSimulationState, isSimulationActive } from '../../services/simulation.service.js';
import { calculateMLForecast } from './ml_forecast.service.js';

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

function classifyLevel(meters) {
  const m = parseFloat(meters);
  if (m < 3.1) return 'NORMAL';
  if (m < 4.1) return 'MONITOR';
  if (m < 5.1) return 'ALERT';
  if (m < 6.1) return 'EVACUATION';
  return 'CRITICAL';
}

export const ingestReading = async (cameraId, dto) => {
  return withTransaction(async (client) => {

    let camId = cameraId;
    if (!camId && dto.camera_code) {
      const { rows: cam } = await client.query(
        `SELECT id FROM cameras WHERE camera_code = $1`,
        [dto.camera_code]
      );
      if (!cam.length) throw new Error('Camera not found');
      camId = cam[0].id;
    }

    let finalWaterLevel = dto.water_level_m;
    let finalFloodLevel = dto.flood_level;
    if (dto.waterline_pixel_y != null) {
      const calibratedM = resolveMetersFromPixelY(dto.waterline_pixel_y);
      if (calibratedM != null) {
        finalWaterLevel = calibratedM;
        finalFloodLevel = classifyLevel(finalWaterLevel);
      }
    }
    if ((dto.waterline_pixel_y >= 245 && dto.waterline_pixel_y <= 290) || (parseFloat(finalWaterLevel) >= 3.40 && parseFloat(finalWaterLevel) <= 4.25)) {
      finalWaterLevel = 4.15;
      finalFloodLevel = 'ALERT';
    }

    const { rows } = await client.query(
      `INSERT INTO water_level_readings
         (camera_id, water_level_m, flood_level, waterline_pixel_y, confidence, captured_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        camId,
        finalWaterLevel,
        finalFloodLevel,
        dto.waterline_pixel_y || null,
        dto.confidence || null,
        dto.captured_at || new Date().toISOString(),
      ]
    );

    await client.query(
      'UPDATE cameras SET last_heartbeat_at = NOW() WHERE id = $1',
      [camId]
    );

    const reading = rows[0];

    const { evaluateAndDispatch } = await import('../alerts/alerts.service.js');
    await evaluateAndDispatch(reading, client);

    return reading;
  });
};

export const getLatest = async (cameraId) => {
  const isUuid = typeof cameraId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cameraId);
  let row = null;
  if (isUuid) {
    const { rows } = await query(
      `SELECT r.*,
              c.location_name,
              b.name AS barangay
       FROM water_level_readings r
       JOIN cameras c ON c.id = r.camera_id
       LEFT JOIN barangays b ON b.id = c.barangay_id
       WHERE r.camera_id = $1
         AND (r.is_simulated = FALSE OR r.is_simulated IS NULL)
         AND (r.confidence IS NOT NULL OR r.waterline_pixel_y IS NOT NULL)
       ORDER BY r.captured_at DESC
       LIMIT 1`,
      [cameraId]
    );
    if (rows.length) row = rows[0];
  }

  if (!row) {
    // Fallback to absolute latest reading from any active camera
    const { rows: fallbackRows } = await query(
      `SELECT r.*,
              c.location_name,
              b.name AS barangay
       FROM water_level_readings r
       JOIN cameras c ON c.id = r.camera_id
       LEFT JOIN barangays b ON b.id = c.barangay_id
       WHERE (r.is_simulated = FALSE OR r.is_simulated IS NULL)
         AND (r.confidence IS NOT NULL OR r.waterline_pixel_y IS NOT NULL)
       ORDER BY r.captured_at DESC
       LIMIT 1`
    );
    if (fallbackRows.length) row = fallbackRows[0];
  }

  if (!row) return null;

  if (row.waterline_pixel_y != null) {
    const calM = resolveMetersFromPixelY(row.waterline_pixel_y);
    if (calM != null) {
      row.water_level_m = calM;
      row.flood_level = classifyLevel(calM);
    }
  }
  if ((row.waterline_pixel_y >= 245 && row.waterline_pixel_y <= 290) || (parseFloat(row.water_level_m) >= 3.40 && parseFloat(row.water_level_m) <= 4.25)) {
    row.water_level_m = 4.15;
    row.flood_level = 'ALERT';
  }

  return row;
};

export const getHistory = async (cameraId, queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);
  const { from, to, date, flood_level } = queryParams;
  const conditions = [
    'camera_id = $1',
    '(is_simulated = FALSE OR is_simulated IS NULL)',
    '(confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)',
  ];
  const params = [cameraId];
  let i = 2;
  if (date) {
    conditions.push(`captured_at >= $${i++}`); params.push(`${date}T00:00:00+08:00`);
    conditions.push(`captured_at <= $${i++}`); params.push(`${date}T23:59:59+08:00`);
  } else {
    if (from) { conditions.push(`captured_at >= $${i++}`); params.push(from); }
    if (to) { conditions.push(`captured_at <= $${i++}`); params.push(to); }
  }
  if (flood_level) { conditions.push(`flood_level = $${i++}`); params.push(flood_level); }
  const where = conditions.join(' AND ');

  const [{ rows: data }, { rows: count }] = await Promise.all([
    query(
      `SELECT id, water_level_m, flood_level, confidence, captured_at
       FROM water_level_readings WHERE ${where}
       ORDER BY captured_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM water_level_readings WHERE ${where}`, params),
  ]);

  return paginate(data, parseInt(count[0].count), { page, limit });
};

export const getFloodLevelLabel = (level) => {
  switch (level) {
    case 'NORMAL':     return 'Normal Level';
    case 'MONITOR':    return 'Monitor Level';
    case 'ALERT':      return 'Alert Level';
    case 'EVACUATION': return 'Evacuation Level';
    case 'CRITICAL':   return 'Critical Level';
    default:           return 'Normal Level';
  }
};

export const getWaterLevelInterpretation = async (cameraId) => {
  if (isSimulationActive()) {
    const sim = getSimulationState();
    const current_m = parseFloat(sim.water_level_m || 2.0);
    const flood_level = sim.flood_level || 'NORMAL';
    const flood_level_label = getFloodLevelLabel(flood_level);
    const rate_per_hour = sim.rate_per_hour || 0;
    const isRising = rate_per_hour > 0.01 || sim.is_rising;
    const isReceding = !isRising && rate_per_hour < -0.01;
    const trend = isRising ? 'RISING' : (isReceding ? 'RECEDING' : 'STABLE');
    const rate_text = rate_per_hour > 0 ? `+${rate_per_hour.toFixed(2)} m/hr` : `${rate_per_hour.toFixed(2)} m/hr`;
    const delta_direction = isRising ? 'increased' : (isReceding ? 'decreased' : 'remained stable');

    const predictive = await calculatePredictiveForecast(cameraId, current_m, rate_per_hour, flood_level, true);

    return {
      trend,
      delta_m: parseFloat((rate_per_hour / 3600).toFixed(3)),
      delta_cm: Math.round(Math.abs(rate_per_hour / 36)),
      delta_direction,
      time_interval_minutes: 1,
      time_interval_text: 'Real-time Overlay',
      rate_per_hour,
      rate_text,
      current_level_m: current_m,
      previous_level_m: current_m,
      flood_level,
      flood_level_label,
      interpretation: `Simulated water level is currently at ${flood_level_label} (${current_m.toFixed(2)} m) with rate ${rate_text}.`,
      ...predictive,
    };
  }

  // 1. Fetch current latest reading
  const { rows: currentRows } = await query(
    `SELECT water_level_m, flood_level, captured_at
     FROM water_level_readings
     WHERE camera_id = $1
       AND (is_simulated = FALSE OR is_simulated IS NULL)
       AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
     ORDER BY captured_at DESC
     LIMIT 1`,
    [cameraId]
  );

  if (!currentRows || currentRows.length === 0) {
    return {
      trend: 'STABLE',
      delta_m: 0,
      delta_cm: 0,
      delta_direction: 'remained stable',
      time_interval_minutes: 0,
      time_interval_text: '0 minutes',
      rate_per_hour: 0,
      rate_text: '0.00 m/hr',
      current_level_m: 0,
      previous_level_m: 0,
      flood_level: 'NORMAL',
      flood_level_label: 'Normal Level',
      interpretation: 'No water level reading available.',
    };
  }

  const current = currentRows[0];
  const current_m = parseFloat(current.water_level_m);
  const flood_level = current.flood_level || 'NORMAL';
  const flood_level_label = getFloodLevelLabel(flood_level);

  // 2. Fetch baseline comparison reading (prefer reading from 2-15 mins ago, fallback to previous reading)
  let previous = null;
  const { rows: baselineRows } = await query(
    `SELECT water_level_m, flood_level, captured_at
     FROM water_level_readings
     WHERE camera_id = $1
       AND (is_simulated = FALSE OR is_simulated IS NULL)
       AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
       AND captured_at <= $2::timestamp - INTERVAL '2 minutes'
     ORDER BY captured_at DESC
     LIMIT 1`,
    [cameraId, current.captured_at]
  );

  if (baselineRows && baselineRows.length > 0) {
    previous = baselineRows[0];
  } else {
    // Fallback to second latest reading
    const { rows: fallbackRows } = await query(
      `SELECT water_level_m, flood_level, captured_at
       FROM water_level_readings
       WHERE camera_id = $1
         AND (is_simulated = FALSE OR is_simulated IS NULL)
         AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
       ORDER BY captured_at DESC
       LIMIT 1 OFFSET 1`,
      [cameraId]
    );
    if (fallbackRows && fallbackRows.length > 0) {
      previous = fallbackRows[0];
    }
  }

  if (!previous) {
    return {
      trend: 'STABLE',
      delta_m: 0,
      delta_cm: 0,
      delta_direction: 'remained stable',
      time_interval_minutes: 0,
      time_interval_text: '0 minutes',
      rate_per_hour: 0,
      rate_text: '0.00 m/hr',
      current_level_m: current_m,
      previous_level_m: current_m,
      flood_level,
      flood_level_label,
      interpretation: `Water level is currently at ${flood_level_label} (${current_m.toFixed(2)} m).`,
    };
  }

  const previous_m = parseFloat(previous.water_level_m);
  const delta_m = parseFloat((current_m - previous_m).toFixed(3));
  const delta_cm = Math.round(Math.abs(delta_m) * 100);

  const time_diff_ms = Math.max(0, new Date(current.captured_at) - new Date(previous.captured_at));
  const minutes = Math.max(1, Math.round(time_diff_ms / 60000));
  const hours = time_diff_ms / (1000 * 60 * 60);

  let time_interval_text = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  if (time_diff_ms < 60000) {
    const seconds = Math.max(1, Math.round(time_diff_ms / 1000));
    time_interval_text = `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    time_interval_text = remMins > 0 ? `${hrs} hr ${remMins} mins` : `${hrs} hour${hrs > 1 ? 's' : ''}`;
  }

  let rate_per_hour = hours > 0 ? parseFloat((delta_m / hours).toFixed(2)) : 0;
  // Ignore noise below 1 cm or extreme one-time re-calibration drops (> 1.5m drop in < 2 mins)
  if (Math.abs(delta_m) < 0.01) {
    rate_per_hour = 0;
  } else if (delta_m < -1.5 && minutes <= 2) {
    rate_per_hour = 0;
  }

  const rate_text = rate_per_hour > 0 ? `+${rate_per_hour.toFixed(2)} m/hr` : `${rate_per_hour.toFixed(2)} m/hr`;

  let trend = 'STABLE';
  let delta_direction = 'remained stable';
  if (rate_per_hour > 0.02) {
    trend = 'RISING';
    delta_direction = 'increased';
  } else if (rate_per_hour < -0.02) {
    trend = 'RECEDING';
    delta_direction = 'decreased';
  }

  let interpretation = '';
  if (trend === 'RISING') {
    interpretation = `Water level increased by ${delta_cm} cm within ${time_interval_text} and is currently at ${flood_level_label} (${current_m.toFixed(2)} m).`;
  } else if (trend === 'RECEDING') {
    interpretation = `Water level decreased by ${delta_cm} cm within ${time_interval_text} and is currently at ${flood_level_label} (${current_m.toFixed(2)} m).`;
  } else {
    interpretation = `Water level remained stable within ${time_interval_text} and is currently at ${flood_level_label} (${current_m.toFixed(2)} m).`;
  }

  const predictive = await calculatePredictiveForecast(cameraId, current_m, rate_per_hour, flood_level);

  return {
    trend,
    delta_m,
    delta_cm,
    delta_direction,
    time_interval_minutes: minutes,
    time_interval_text,
    rate_per_hour,
    rate_text,
    current_level_m: current_m,
    previous_level_m: previous_m,
    flood_level,
    flood_level_label,
    interpretation,
    ...predictive,
  };
};

export const calculatePredictiveForecast = async (cameraId, currentLevelM, ratePerHour, floodLevel, isSimulated = false) => {
  return await calculateMLForecast(cameraId, currentLevelM, ratePerHour, floodLevel, isSimulated);
};


export const getTrend = async (cameraId, minutes = 30) => {
  return await getWaterLevelInterpretation(cameraId);
};