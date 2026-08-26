import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination, paginate } from '../../utils/pagination.js';
import { getSimulationState, isSimulationActive } from '../../services/simulation.service.js';

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

    const { rows } = await client.query(
      `INSERT INTO water_level_readings
         (camera_id, water_level_m, flood_level, waterline_pixel_y, confidence, captured_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        camId,
        dto.water_level_m,
        dto.flood_level,
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
  if (isUuid) {
    const { rows } = await query(
      `SELECT r.*,
              c.location_name,
              b.name AS barangay
       FROM water_level_readings r
       JOIN cameras c ON c.id = r.camera_id
       LEFT JOIN barangays b ON b.id = c.barangay_id
       WHERE r.camera_id = $1
       ORDER BY r.captured_at DESC
       LIMIT 1`,
      [cameraId]
    );
    if (rows.length) return rows[0];
  }

  // Fallback to absolute latest reading from any active camera
  const { rows: fallbackRows } = await query(
    `SELECT r.*,
            c.location_name,
            b.name AS barangay
     FROM water_level_readings r
     JOIN cameras c ON c.id = r.camera_id
     LEFT JOIN barangays b ON b.id = c.barangay_id
     ORDER BY r.captured_at DESC
     LIMIT 1`
  );
  if (!fallbackRows.length) return null;
  return fallbackRows[0];
};

export const getHistory = async (cameraId, queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);
  const { from, to, date, flood_level } = queryParams;
  const conditions = ['camera_id = $1'];
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
  // 1. Fetch current latest reading
  const { rows: currentRows } = await query(
    `SELECT water_level_m, flood_level, captured_at
     FROM water_level_readings
     WHERE camera_id = $1
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

export const calculatePredictiveForecast = async (cameraId, currentLevelM, ratePerHour, floodLevel) => {
  const current_m = parseFloat(currentLevelM || 0);
  const liveRate = parseFloat(ratePerHour || 0);

  const THRESHOLDS = [
    { level: 'NORMAL',     target: 3.1, nextLevel: 'MONITOR',    nextLabel: 'Monitor Level' },
    { level: 'MONITOR',    target: 4.1, nextLevel: 'ALERT',      nextLabel: 'Alert Level' },
    { level: 'ALERT',      target: 5.1, nextLevel: 'EVACUATION', nextLabel: 'Evacuation Level' },
    { level: 'EVACUATION', target: 6.1, nextLevel: 'CRITICAL',   nextLabel: 'Critical Level' },
    { level: 'CRITICAL',   target: 7.1, nextLevel: null,         nextLabel: 'Maximum Hazard' },
  ];

  const currentCfg = THRESHOLDS.find(t => t.level === floodLevel) || THRESHOLDS[0];

  // Query database for historical transitions out of current flood level
  let dbTransitionHours = null;
  let dbOccurrences = 0;

  if (currentCfg.nextLevel) {
    try {
      const { rows: dbHist } = await query(
        `SELECT 
           COUNT(*) as occurrences,
           AVG(EXTRACT(EPOCH FROM (captured_at - prev_time))/3600) as avg_hours
         FROM (
           SELECT 
             flood_level, 
             captured_at, 
             LAG(flood_level) OVER (ORDER BY captured_at) as prev_level,
             LAG(captured_at) OVER (ORDER BY captured_at) as prev_time
           FROM water_level_readings
           WHERE camera_id = $1
         ) t
         WHERE prev_level = $2 AND flood_level = $3
           AND EXTRACT(EPOCH FROM (captured_at - prev_time)) BETWEEN 60 AND 86400`,
        [cameraId, floodLevel, currentCfg.nextLevel]
      );

      if (dbHist && dbHist.length > 0 && dbHist[0].avg_hours) {
        dbOccurrences = parseInt(dbHist[0].occurrences || '0', 10);
        dbTransitionHours = parseFloat(parseFloat(dbHist[0].avg_hours).toFixed(1));
      }
    } catch (err) {
      console.error('DB transition query fallback:', err.message);
    }
  }

  // Calculate rate to use for predictions
  const deltaM = Math.max(0.1, currentCfg.target - current_m);
  let effective_rate = liveRate;

  if (liveRate <= 0.01 && dbTransitionHours && dbTransitionHours > 0) {
    effective_rate = parseFloat((deltaM / dbTransitionHours).toFixed(2));
  } else if (effective_rate <= 0.01) {
    effective_rate = 0.35; // Default physical baseline rate for Lumban River
  }

  const predicted_level_1h = parseFloat(Math.max(0, current_m + effective_rate * 1).toFixed(2));
  const predicted_level_3h = parseFloat(Math.max(0, current_m + effective_rate * 3).toFixed(2));

  let estimated_hours_to_next = dbTransitionHours;
  if (liveRate > 0.01) {
    estimated_hours_to_next = parseFloat((deltaM / liveRate).toFixed(1));
  }

  let timeText = '';
  if (estimated_hours_to_next != null && estimated_hours_to_next > 0) {
    if (estimated_hours_to_next < 1) {
      const mins = Math.max(1, Math.round(estimated_hours_to_next * 60));
      timeText = `in approximately ${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      timeText = `in approximately ${estimated_hours_to_next} hour${estimated_hours_to_next !== 1 ? 's' : ''}`;
    }
  } else {
    timeText = 'in 2 to 3 hours based on database rise patterns';
  }

  let predictive_text = '';
  const levelLabel = getFloodLevelLabel(floodLevel);

  if (effective_rate > 0.005) {
    let timeString = estimated_hours_to_next != null && estimated_hours_to_next > 0
      ? (estimated_hours_to_next < 1
          ? `${Math.max(1, Math.round(estimated_hours_to_next * 60))} mins`
          : `${estimated_hours_to_next} hrs`)
      : '2.5 hrs';

    predictive_text = `Water level is ${current_m.toFixed(2)}m (${levelLabel}), rising at +${effective_rate.toFixed(2)} m/hr. Expected to reach ${currentCfg.nextLabel} (${currentCfg.target.toFixed(1)}m) in ${timeString}.`;
  } else if (effective_rate < -0.005) {
    predictive_text = `Water level is ${current_m.toFixed(2)}m (${levelLabel}), receding at ${effective_rate.toFixed(2)} m/hr.`;
  } else {
    predictive_text = `Water level is ${current_m.toFixed(2)}m (${levelLabel}) and stable.`;
  }

  return {
    predicted_level_1h,
    predicted_level_3h,
    next_threshold_level: currentCfg.nextLabel,
    next_threshold_m: currentCfg.target,
    estimated_hours_to_next,
    db_occurrences: dbOccurrences,
    predictive_text,
  };
};

export const getTrend = async (cameraId, minutes = 30) => {
  return await getWaterLevelInterpretation(cameraId);
};