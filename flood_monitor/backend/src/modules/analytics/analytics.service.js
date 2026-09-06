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

export const generateReferenceCode = (entityType = '') => {
  const norm = (entityType || '').toLowerCase();
  let prefix = 'LOG';
  if (norm.includes('user') || norm.includes('account')) prefix = 'USR';
  else if (norm.includes('camera') || norm.includes('sensor') || norm.includes('reading')) prefix = 'CAM';
  else if (norm.includes('alert') || norm.includes('warning')) prefix = 'ALT';
  else if (norm.includes('sos') || norm.includes('emergency')) prefix = 'SOS';
  else if (norm.includes('rescue') || norm.includes('responder')) prefix = 'RES';
  else if (norm.includes('evac') || norm.includes('center') || norm.includes('family')) prefix = 'EVC';
  else if (norm.includes('drill') || norm.includes('sim')) prefix = 'DRL';
  else if (norm.includes('system') || norm.includes('setting') || norm.includes('maintenance')) prefix = 'SYS';
  else if (norm.includes('risk') || norm.includes('zone')) prefix = 'RSK';

  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${hash}`;
};

export const getAuditLogs = async (params = {}) => {
  const limit  = Math.min(100, parseInt(params.limit || '50', 10));
  const offset = Math.max(0,   parseInt(params.offset || '0',  10));

  const { rows } = await query(
    `SELECT a.*, u.email AS user_email, u.role AS user_role, u.full_name AS user_full_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
};

export const createAuditLog = async ({
  userId,
  action,
  description,
  notes,
  severity,
  entityType,
  entityId,
  beforeState,
  afterState,
  ipAddress,
  userAgent,
  createdAt,
  isManual = true,
}) => {
  const finalEntityId = (entityId && entityId.trim()) ? entityId.trim() : generateReferenceCode(entityType);
  const finalSeverity = (severity || 'NORMAL').toUpperCase().trim();
  const headline = (description || '').trim();

  let finalAfterState = null;
  if (afterState) {
    finalAfterState = typeof afterState === 'string' ? afterState : JSON.stringify(afterState);
  } else if (headline || notes) {
    finalAfterState = JSON.stringify({
      summary: headline,
      notes: (notes || '').trim(),
      severity: finalSeverity,
      reference_id: finalEntityId,
      is_manual: isManual,
    });
  }

  const { rows } = await query(
    `INSERT INTO audit_logs
       (user_id, action, description, entity_type, entity_id, before_state, after_state, ip_address, user_agent, is_manual, severity, created_at, actual_created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::timestamptz, NOW()), NOW())
     RETURNING *`,
    [
      userId || null,
      (action || 'MANUAL_ENTRY').toUpperCase().trim(),
      headline || null,
      entityType || null,
      finalEntityId,
      beforeState ? (typeof beforeState === 'string' ? beforeState : JSON.stringify(beforeState)) : null,
      finalAfterState,
      ipAddress || '127.0.0.1',
      userAgent || 'Admin Console',
      isManual,
      finalSeverity,
      createdAt || null,
    ]
  );
  return rows[0];
};

export const updateAuditLog = async (id, {
  userId,
  action,
  description,
  notes,
  severity,
  entityType,
  entityId,
  beforeState,
  afterState,
  ipAddress,
  userAgent,
  createdAt,
}) => {
  const headline = description !== undefined ? (description || '').trim() : undefined;
  const finalSeverity = severity ? severity.toUpperCase().trim() : undefined;

  let finalAfterState = undefined;
  if (afterState !== undefined) {
    finalAfterState = afterState ? (typeof afterState === 'string' ? afterState : JSON.stringify(afterState)) : null;
  } else if (headline !== undefined || notes !== undefined) {
    finalAfterState = JSON.stringify({
      summary: headline || '',
      notes: notes !== undefined ? (notes || '').trim() : '',
      severity: finalSeverity || 'NORMAL',
      reference_id: entityId || '',
      is_manual: true,
    });
  }

  const { rows } = await query(
    `UPDATE audit_logs
     SET
       user_id = COALESCE($2, user_id),
       action = COALESCE($3, action),
       description = COALESCE($4, description),
       entity_type = COALESCE($5, entity_type),
       entity_id = COALESCE($6, entity_id),
       before_state = COALESCE($7, before_state),
       after_state = COALESCE($8, after_state),
       severity = COALESCE($9, severity),
       ip_address = COALESCE($10, ip_address),
       user_agent = COALESCE($11, user_agent),
       created_at = COALESCE($12::timestamptz, created_at)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      userId !== undefined ? (userId || null) : null,
      action ? action.toUpperCase().trim() : null,
      headline !== undefined ? headline : null,
      entityType !== undefined ? entityType : null,
      entityId !== undefined ? entityId : null,
      beforeState ? (typeof beforeState === 'string' ? beforeState : JSON.stringify(beforeState)) : null,
      finalAfterState !== undefined ? finalAfterState : null,
      finalSeverity !== undefined ? finalSeverity : null,
      ipAddress || null,
      userAgent || null,
      createdAt || null,
    ]
  );
  if (!rows[0]) throw new Error('Audit log not found');
  return rows[0];
};

export const deleteAuditLog = async (id) => {
  const { rows } = await query(
    `DELETE FROM audit_logs WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!rows[0]) throw new Error('Audit log not found');
  return rows[0];
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