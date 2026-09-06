import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

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

export const formatAuditDescription = (log, usersMap = {}, barangaysMap = {}) => {
  if (log.description && log.description.trim()) {
    return log.description.trim();
  }

  const action = log.action || '';
  const rawState = log.after_state || log.before_state || {};
  const s = typeof rawState === 'string'
    ? (() => { try { return JSON.parse(rawState); } catch { return {}; } })()
    : (rawState || {});

  // 1. Dispatch Events (SOS_DISPATCHED_PRIMARY, SOS_DISPATCHED_BACKUP, BACKUP_DISPATCHED)
  if (action.includes('DISPATCHED') || action.includes('DISPATCH')) {
    const responderIds = s.assigned_responders || (s.responder_id ? [s.responder_id] : []) || [];
    const responderList = Array.isArray(responderIds) ? responderIds : [responderIds];

    if (responderList.length > 0) {
      const names = responderList.map(rid => {
        const u = usersMap[rid];
        if (!u) return 'Responder';
        const roleLabel = u.role ? `${u.role} Team` : 'Responder Unit';
        return `${roleLabel} (Officer ${u.full_name || u.email || 'Responder'})`;
      });
      const teamText = names.join(' and ');
      const notes = s.notes ? ` — Notes: ${s.notes}` : '';
      return `Dispatched ${teamText}${notes}`;
    }

    if (s.notes) {
      return `Dispatched response team — Notes: ${s.notes}`;
    }
    return `Dispatched emergency response units`;
  }

  // 2. SOS Distress Call Created
  if (action === 'SOS_CREATED') {
    let loc = '';
    if (s.lat && s.lng) {
      loc = `coordinates (${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)})`;
    }
    const bName = s.barangay_id ? barangaysMap[s.barangay_id] : null;
    if (loc && bName) {
      return `SOS distress call reported at ${loc} in Brgy. ${bName}`;
    }
    if (loc) {
      return `SOS distress call reported at ${loc}`;
    }
    if (bName) {
      return `SOS distress call reported in Brgy. ${bName}`;
    }
    return `SOS distress call reported`;
  }

  // 3. SOS Response Lifecycle
  if (action === 'SOS_RESPONDED_EN_ROUTE' || action === 'SOS_RESPONDED') {
    return 'Responder acknowledged and is currently en route to distress location';
  }
  if (action === 'SOS_RESPONDED_RESCUE_IN_PROGRESS') {
    return 'Rescue operation is in progress on site';
  }
  if (action === 'SOS_RESCUE_COMPLETED') {
    return 'Rescue operation successfully completed';
  }
  if (action === 'SOS_CANCELLED') {
    return 'SOS distress request cancelled by resident';
  }
  if (action === 'SOS_DISPATCH_DECLINED') {
    return 'Responder declined dispatch order';
  }
  if (action === 'BACKUP_REQUESTED') {
    const roleReq = s.target_role || s.role || 'additional';
    return `Field responder requested ${roleReq} backup assistance`;
  }
  if (action === 'BACKUP_RESOLVED') {
    return 'Field backup request resolved and cleared';
  }

  // 4. Flood Simulation & Drills
  if (action === 'DRILL_SCENARIO_STARTED') {
    const name = s.scenario_name || s.name || 'Emergency Drill';
    const target = s.target_level_m ? ` (Target: ${s.target_level_m}m)` : '';
    return `Drill scenario started: ${name}${target}`;
  }
  if (action === 'DRILL_SCENARIO_COMPLETED') {
    return `Drill scenario completed successfully`;
  }
  if (action === 'DRILL_THRESHOLD_BREACHED') {
    return `Drill warning threshold reached`;
  }
  if (action === 'SIMULATION_STARTED') {
    const level = s.water_level_m ? ` (Water level: ${Number(s.water_level_m).toFixed(2)}m)` : '';
    return `Flood simulation initiated${level}`;
  }
  if (action === 'SIMULATION_STOPPED') {
    return `Flood simulation stopped and deactivated`;
  }
  if (action === 'SIMULATION_RESET') {
    return `Flood simulation reset to normal baseline`;
  }

  // 5. Alerts & Sirens
  if (action === 'ALERT_DISPATCHED' || action === 'ALERT_TRIGGERED') {
    const lvl = s.flood_level ? ` (${s.flood_level})` : '';
    return `Flood warning alert triggered and dispatched${lvl}`;
  }
  if (action === 'MANUAL_SIREN_TRIGGERED') {
    return `Emergency warning siren manually sounded`;
  }

  // 6. Announcements & Evacuation
  if (action === 'ANNOUNCEMENT_CREATED') {
    const title = s.title ? `: "${s.title}"` : '';
    return `Public safety announcement posted${title}`;
  }
  if (action === 'ANNOUNCEMENT_DEACTIVATED') {
    return `Public safety announcement deactivated`;
  }
  if (action.includes('EVAC_CENTER')) {
    const center = s.name ? ` "${s.name}"` : '';
    if (action.includes('CREATED')) return `Evacuation center${center} registered`;
    if (action.includes('UPDATED')) return `Evacuation center${center} updated`;
    if (action.includes('DELETED')) return `Evacuation center${center} removed`;
  }
  if (action === 'FAMILY_ADDED') {
    return `Evacuee family registered at evacuation center`;
  }
  if (action === 'FAMILY_UPDATED') {
    return `Evacuee family records updated`;
  }

  // 7. Users & Security
  if (action === 'USER_LOGIN') {
    return `User logged into the system console`;
  }
  if (action === 'USER_REGISTER') {
    return `New user account registered`;
  }
  if (action === 'USER_CREATED') {
    return `User account created by administrator`;
  }
  if (action === 'USER_UPDATED') {
    return `User account profile updated`;
  }
  if (action === 'USER_DEACTIVATED') {
    return `User account deactivated`;
  }
  if (action === 'USER_DELETED') {
    return `User account permanently deleted`;
  }

  // 8. Custom / Explicit messages
  if (s.message && typeof s.message === 'string') {
    return s.message;
  }
  if (s.notes && typeof s.notes === 'string') {
    return s.notes;
  }
  if (s.reason && typeof s.reason === 'string') {
    return s.reason;
  }

  // If no additional details or unknown action:
  return '—';
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

  // Collect any responder IDs and barangay IDs to resolve names
  const userIdsToFetch = new Set();
  const barangayIdsToFetch = new Set();

  for (const row of rows) {
    const states = [row.after_state, row.before_state];
    for (const st of states) {
      if (!st) continue;
      const obj = typeof st === 'string' ? (() => { try { return JSON.parse(st); } catch { return {}; } })() : st;
      if (obj.assigned_responders && Array.isArray(obj.assigned_responders)) {
        for (const id of obj.assigned_responders) {
          if (typeof id === 'string' && id.length >= 30) userIdsToFetch.add(id);
        }
      }
      if (obj.responder_id && typeof obj.responder_id === 'string') {
        userIdsToFetch.add(obj.responder_id);
      }
      if (obj.barangay_id && typeof obj.barangay_id === 'string') {
        barangayIdsToFetch.add(obj.barangay_id);
      }
    }
  }

  const usersMap = {};
  if (userIdsToFetch.size > 0) {
    try {
      const { rows: uRows } = await query(
        `SELECT id, full_name, email, role, responder_type FROM users WHERE id = ANY($1::uuid[])`,
        [Array.from(userIdsToFetch)]
      );
      for (const u of uRows) {
        usersMap[u.id] = u;
      }
    } catch (_) {}
  }

  const barangaysMap = {};
  if (barangayIdsToFetch.size > 0) {
    try {
      const { rows: bRows } = await query(
        `SELECT id, name FROM barangays WHERE id = ANY($1::uuid[])`,
        [Array.from(barangayIdsToFetch)]
      );
      for (const b of bRows) {
        barangaysMap[b.id] = b.name;
      }
    } catch (_) {}
  }

  // Format clean readable descriptions for MDRRMO officers
  for (const row of rows) {
    const readable = formatAuditDescription(row, usersMap, barangaysMap);
    row.description = readable;
  }

  return rows;
};

function safeUuid(val) {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
}

function safeTimestamp(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function safeJson(val) {
  if (!val) return null;
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return null;
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed);
    } catch {
      return JSON.stringify({ raw: trimmed });
    }
  }
  return null;
}

export const createAuditLog = async ({
  userId,
  action,
  description,
  entityType,
  entityId,
  beforeState,
  afterState,
  ipAddress,
  userAgent,
  createdAt,
}) => {
  const autoEntityId = entityId && entityId.trim() && entityId.trim() !== 'Auto-generated upon save'
    ? entityId.trim().slice(0, 100)
    : `LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  let validUserId = safeUuid(userId);
  if (validUserId) {
    try {
      const { rows: uRows } = await query('SELECT id FROM users WHERE id = $1', [validUserId]);
      if (!uRows.length) validUserId = null;
    } catch {
      validUserId = null;
    }
  }

  const validCreatedAt = safeTimestamp(createdAt);
  const validBeforeState = safeJson(beforeState);
  const validAfterState  = safeJson(afterState);

  const { rows } = await query(
    `INSERT INTO audit_logs
       (user_id, action, description, entity_type, entity_id, before_state, after_state, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()))
     RETURNING *`,
    [
      validUserId,
      (action || 'MANUAL_ENTRY').toUpperCase().trim(),
      description ? String(description).trim() : null,
      entityType ? String(entityType).trim().slice(0, 100) : null,
      autoEntityId,
      validBeforeState,
      validAfterState,
      ipAddress || '127.0.0.1',
      userAgent || 'Admin Console',
      validCreatedAt,
    ]
  );
  return rows[0];
};

export const updateAuditLog = async (id, {
  userId,
  action,
  description,
  entityType,
  entityId,
  beforeState,
  afterState,
  ipAddress,
  userAgent,
  createdAt,
}) => {
  const validId = safeUuid(id);
  if (!validId) {
    throw ApiError.badRequest('Invalid audit log ID format');
  }

  let validUserId = safeUuid(userId);
  if (validUserId) {
    try {
      const { rows: uRows } = await query('SELECT id FROM users WHERE id = $1', [validUserId]);
      if (!uRows.length) validUserId = null;
    } catch {
      validUserId = null;
    }
  }

  const validCreatedAt = safeTimestamp(createdAt);
  const validBeforeState = safeJson(beforeState);
  const validAfterState  = safeJson(afterState);

  const { rows } = await query(
    `UPDATE audit_logs
     SET
       user_id = $2,
       action = COALESCE($3, action),
       description = $4,
       entity_type = $5,
       entity_id = COALESCE($6, entity_id),
       before_state = COALESCE($7, before_state),
       after_state = COALESCE($8, after_state),
       ip_address = COALESCE($9, ip_address),
       user_agent = COALESCE($10, user_agent),
       created_at = COALESCE($11::timestamptz, created_at)
     WHERE id = $1
     RETURNING *`,
    [
      validId,
      validUserId,
      action ? action.toUpperCase().trim() : null,
      description !== undefined ? (description ? String(description).trim() : null) : null,
      entityType !== undefined ? (entityType ? String(entityType).trim().slice(0, 100) : null) : null,
      entityId !== undefined ? (entityId ? String(entityId).trim().slice(0, 100) : null) : null,
      validBeforeState,
      validAfterState,
      ipAddress || null,
      userAgent || null,
      validCreatedAt,
    ]
  );
  if (!rows[0]) throw ApiError.notFound('Audit log not found');
  return rows[0];
};

export const deleteAuditLog = async (id) => {
  const validId = safeUuid(id);
  if (!validId) {
    throw ApiError.badRequest('Invalid audit log ID format');
  }
  const { rows } = await query(
    `DELETE FROM audit_logs WHERE id = $1 RETURNING id`,
    [validId]
  );
  if (!rows[0]) throw ApiError.notFound('Audit log not found');
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