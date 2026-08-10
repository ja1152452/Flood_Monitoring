import { query } from '../../config/db.js';

export const getSummary = async () => {
  const [cameras, alerts, sos, reading] = await Promise.all([
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM cameras`),
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active_alerts FROM flood_alerts`),
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'PENDING') AS pending FROM sos_requests`),
    query(
      `SELECT water_level_m, flood_level, captured_at
       FROM water_level_readings
       ORDER BY captured_at DESC LIMIT 1`
    ),
  ]);

  return {
    cameras:        cameras.rows[0],
    alerts:         alerts.rows[0],
    sos:            sos.rows[0],
    latest_reading: reading.rows[0] || null,
  };
};

export const getHourlyData = async (cameraId, hours = 24) => {
  const { rows } = await query(
    `SELECT
       date_trunc('hour', captured_at) AS hour,
       AVG(water_level_m)::numeric(6,3) AS avg_level_m,
       MAX(water_level_m)::numeric(6,3) AS max_level_m,
       MIN(water_level_m)::numeric(6,3) AS min_level_m,
       COUNT(*) AS sample_count
     FROM water_level_readings
     WHERE camera_id = $1
       AND captured_at >= NOW() - ($2 || ' hours')::interval
     GROUP BY date_trunc('hour', captured_at)
     ORDER BY hour ASC`,
    [cameraId, hours]
  );
  return rows;
};

export const getAlertFrequency = async (days = 30) => {
  const { rows } = await query(
    `SELECT
       DATE(triggered_at AT TIME ZONE 'Asia/Manila') AS date,
       flood_level,
       COUNT(*) AS count
     FROM flood_alerts
     WHERE triggered_at >= NOW() - ($1 || ' days')::interval
     GROUP BY date, flood_level
     ORDER BY date ASC, flood_level`,
    [days]
  );
  return rows;
};

export const getAuditLogs = async (params = {}) => {
  const limit  = Math.min(100, parseInt(params.limit || '50', 10));
  const offset = Math.max(0,   parseInt(params.offset || '0',  10));

  const { rows } = await query(
    `SELECT a.*, u.email AS user_email, u.role AS user_role
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
};

export const getReadingTrend = async (cameraId, minutes = 60) => {
  const { rows } = await query(
    `SELECT
       water_level_m,
       flood_level,
       captured_at
     FROM water_level_readings
     WHERE camera_id = $1
       AND captured_at >= NOW() - ($2 || ' minutes')::interval
     ORDER BY captured_at ASC`,
    [cameraId, minutes]
  );
  return rows;
};