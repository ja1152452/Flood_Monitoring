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
       WHERE (is_simulated = FALSE OR is_simulated IS NULL)
         AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
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
       AND (is_simulated = FALSE OR is_simulated IS NULL)
       AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
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
  const action = log.action || '';
  const rawState = log.after_state || log.before_state || {};
  const s = typeof rawState === 'string'
    ? (() => { try { return JSON.parse(rawState); } catch { return {}; } })()
    : (rawState || {});

  // 1. User Account Creation (Requirement 1)
  if (action === 'USER_CREATED') {
    const role = s.role || s.user_role || (log.entity_id && usersMap[log.entity_id]?.role);
    const email = s.email || s.user_email || (log.entity_id && usersMap[log.entity_id]?.email);
    if (role && email) {
      return `Created ${role} account for ${email}`;
    }
    if (email) {
      return `Created account for ${email}`;
    }
    if (role) {
      return `Created ${role} account`;
    }
    if (log.description && log.description.trim() && !log.description.includes('by administrator')) {
      return log.description.trim();
    }
    return `User account created by administrator`;
  }

  // 2. Dispatch Events (Requirement 2: SOS_DISPATCHED_PRIMARY, SOS_DISPATCHED_BACKUP, BACKUP_DISPATCHED, RESCUE_DISPATCHED)
  if (action.includes('DISPATCHED') || action.includes('DISPATCH')) {
    const isBackup = action.includes('BACKUP') || s.dispatch_type === 'BACKUP';
    const isPrimary = action.includes('PRIMARY') || s.dispatch_type === 'PRIMARY';
    const prefix = isBackup ? 'Dispatched backup: ' : (isPrimary ? 'Dispatched primary: ' : 'Dispatched: ');

    const responderIds = s.assigned_responders || (s.responder_id ? [s.responder_id] : (s.responderId ? [s.responderId] : [])) || [];
    const responderList = Array.isArray(responderIds) ? responderIds : [responderIds];

    const teamDescriptions = [];
    for (const rid of responderList) {
      const u = typeof rid === 'string' ? usersMap[rid] : (typeof rid === 'object' ? rid : null);
      if (u) {
        const roleLabel = u.role ? `${u.role} Team` : 'Responder Unit';
        teamDescriptions.push(`${roleLabel} (Officer ${u.full_name || u.email || 'Responder'})`);
      }
    }

    if (teamDescriptions.length === 0) {
      const rRole = s.responder_role || s.role;
      const rName = s.responder_name || s.full_name || s.name;
      if (rRole && rName) {
        teamDescriptions.push(`${rRole} Team (Officer ${rName})`);
      } else if (rRole) {
        teamDescriptions.push(`${rRole} Team`);
      } else if (rName) {
        teamDescriptions.push(`Officer ${rName}`);
      } else if (s.team_summary && typeof s.team_summary === 'string' && s.team_summary.trim()) {
        teamDescriptions.push(s.team_summary.trim());
      }
    }

    if (teamDescriptions.length > 0) {
      const teamText = teamDescriptions.join(' and ');
      const notes = s.notes ? ` — Notes: ${s.notes}` : '';
      return `${prefix}${teamText}${notes}`;
    }

    if (log.description && log.description.trim() && !log.description.includes('emergency response units') && !log.description.includes('response team')) {
      return log.description.trim();
    }

    if (s.notes) {
      return `${prefix}response team — Notes: ${s.notes}`;
    }
    return `${prefix}emergency response units`;
  }

  // For other events, if a pre-saved clean description exists, use it
  if (log.description && log.description.trim()) {
    return log.description.trim();
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

  const conditions = [];
  const values = [];

  // Category filter: 'live' vs 'simulation'
  if (params.category === 'live') {
    conditions.push(`(a.action NOT ILIKE '%SIMULATION%' AND a.action NOT ILIKE '%DRILL%' AND (a.entity_type IS NULL OR a.entity_type NOT ILIKE '%SIMULATION%'))`);
  } else if (params.category === 'simulation') {
    conditions.push(`(a.action ILIKE '%SIMULATION%' OR a.action ILIKE '%DRILL%' OR a.entity_type ILIKE '%SIMULATION%')`);
  }

  // Action filter
  if (params.action && params.action.trim()) {
    values.push(`%${params.action.trim()}%`);
    conditions.push(`a.action ILIKE $${values.length}`);
  }

  // Search filter (searches action, description, entity_type, entity_id, user_email, full_name)
  if (params.search && params.search.trim()) {
    values.push(`%${params.search.trim()}%`);
    const p = `$${values.length}`;
    conditions.push(`(
      a.action ILIKE ${p} OR
      a.description ILIKE ${p} OR
      a.entity_type ILIKE ${p} OR
      a.entity_id ILIKE ${p} OR
      u.email ILIKE ${p} OR
      u.full_name ILIKE ${p}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);
  const limitIdx = values.length;
  values.push(offset);
  const offsetIdx = values.length;

  const { rows } = await query(
    `SELECT a.*, u.email AS user_email, u.role AS user_role, u.full_name AS user_full_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );

  // Collect any responder IDs and barangay IDs to resolve names
  const userIdsToFetch = new Set();
  const barangayIdsToFetch = new Set();

  for (const row of rows) {
    if ((row.action === 'USER_CREATED' || row.entity_type === 'users') && row.entity_id && row.entity_id.length >= 30) {
      userIdsToFetch.add(row.entity_id);
    }

    const states = [row.after_state, row.before_state];
    for (const st of states) {
      if (!st) continue;
      const obj = typeof st === 'string' ? (() => { try { return JSON.parse(st); } catch { return {}; } })() : st;
      if (obj.assigned_responders && Array.isArray(obj.assigned_responders)) {
        for (const id of obj.assigned_responders) {
          if (typeof id === 'string' && id.length >= 30) userIdsToFetch.add(id);
        }
      }
      if (obj.responder_id && typeof obj.responder_id === 'string' && obj.responder_id.length >= 30) {
        userIdsToFetch.add(obj.responder_id);
      }
      if (obj.responderId && typeof obj.responderId === 'string' && obj.responderId.length >= 30) {
        userIdsToFetch.add(obj.responderId);
      }
      if (obj.user_id && typeof obj.user_id === 'string' && obj.user_id.length >= 30) {
        userIdsToFetch.add(obj.user_id);
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
       AND (is_simulated = FALSE OR is_simulated IS NULL)
       AND (confidence IS NOT NULL OR waterline_pixel_y IS NOT NULL)
       AND captured_at >= NOW() - ($2 || ' minutes')::interval
     ORDER BY captured_at ASC`,
    [cameraId, minutes]
  );
  return rows;
};

export const getDrillSessions = async () => {
  const { rows } = await query(
    `SELECT * FROM simulation_drill_sessions ORDER BY started_at DESC NULLS LAST, created_at DESC`
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    scenarioType: r.scenario_type,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationSec: r.duration_sec,
    startLevelM: r.start_level_m != null ? parseFloat(r.start_level_m) : null,
    targetLevelM: r.target_level_m != null ? parseFloat(r.target_level_m) : null,
    peakLevelM: r.peak_level_m != null ? parseFloat(r.peak_level_m) : null,
    peakCategory: r.peak_category,
    pointsCount: r.points_count,
    timeToMonitorSec: r.time_to_monitor_sec,
    timeToAlertSec: r.time_to_alert_sec,
    timeToEvacuationSec: r.time_to_evacuation_sec,
    timeToCriticalSec: r.time_to_critical_sec,
    points: r.points || [],
  }));
};

export const saveDrillSession = async (session) => {
  if (!session || !session.id || !session.name) {
    throw ApiError.badRequest('Session ID and Name are required');
  }

  const { rows } = await query(
    `INSERT INTO simulation_drill_sessions (
       id, name, scenario_type, started_at, finished_at, duration_sec,
       start_level_m, target_level_m, peak_level_m, peak_category,
       points_count, time_to_monitor_sec, time_to_alert_sec, time_to_evacuation_sec,
       time_to_critical_sec, points, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       scenario_type = EXCLUDED.scenario_type,
       started_at = EXCLUDED.started_at,
       finished_at = EXCLUDED.finished_at,
       duration_sec = EXCLUDED.duration_sec,
       start_level_m = EXCLUDED.start_level_m,
       target_level_m = EXCLUDED.target_level_m,
       peak_level_m = EXCLUDED.peak_level_m,
       peak_category = EXCLUDED.peak_category,
       points_count = EXCLUDED.points_count,
       time_to_monitor_sec = EXCLUDED.time_to_monitor_sec,
       time_to_alert_sec = EXCLUDED.time_to_alert_sec,
       time_to_evacuation_sec = EXCLUDED.time_to_evacuation_sec,
       time_to_critical_sec = EXCLUDED.time_to_critical_sec,
       points = EXCLUDED.points,
       updated_at = NOW()
     RETURNING *`,
    [
      session.id,
      session.name,
      session.scenarioType || 'manual',
      safeTimestamp(session.startedAt) || new Date().toISOString(),
      safeTimestamp(session.finishedAt) || null,
      session.durationSec || 0,
      session.startLevelM || 2.0,
      session.targetLevelM || 5.5,
      session.peakLevelM || 2.0,
      session.peakCategory || 'NORMAL',
      session.pointsCount || (session.points ? session.points.length : 0),
      session.timeToMonitorSec || null,
      session.timeToAlertSec || null,
      session.timeToEvacuationSec || null,
      session.timeToCriticalSec || null,
      JSON.stringify(session.points || []),
    ]
  );
  return rows[0];
};

export const deleteDrillSession = async (id) => {
  if (!id) throw ApiError.badRequest('Session ID is required');
  const { rows } = await query(
    `DELETE FROM simulation_drill_sessions WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows[0] || null;
};