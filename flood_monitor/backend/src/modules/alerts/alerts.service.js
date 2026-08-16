import { query, withTransaction } from '../../config/db.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { sendPushNotification } from '../../services/firebase.js';
import { getIO } from '../../config/socket.js';

const SIREN_LEVELS = new Set(['MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL']);
const SMS_LEVELS = new Set(['EVACUATION', 'CRITICAL']);

const ESCALATION_MAP = {
  MONITOR: ['ADMIN', 'SUPER_ADMIN', 'PNP', 'BFP', 'RHU', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE', 'CITIZEN'],
  ALERT: ['ADMIN', 'SUPER_ADMIN', 'PNP', 'BFP', 'RHU', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE', 'CITIZEN'],
  EVACUATION: ['ADMIN', 'SUPER_ADMIN', 'PNP', 'BFP', 'RHU', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE', 'CITIZEN'],
  CRITICAL: ['ADMIN', 'SUPER_ADMIN', 'PNP', 'BFP', 'RHU', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE', 'CITIZEN'],
};

const RESPONDER_ROLES = new Set(['PNP', 'BFP', 'RHU', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE']);


const buildMessages = (level) => ({
  responder: `Action Required: Please prepare for deployment/rescue operations. Water level has reached ${level} level.`,
  resident: `Water Level Alert: The water has reached the ${level} level. Please prepare for immediate evacuation.`,
  mdrrmo: `[SYSTEM] Water level has reached ${level} threshold. Alert has been triggered automatically.`,
});

export const evaluateAndDispatch = async (reading, client) => {
  const db = client || { query: (...a) => query(...a) };
  const level = reading.flood_level;

  if (level === 'NORMAL') {
    const { rows: resolved } = await db.query(
      `UPDATE flood_alerts
       SET is_active = FALSE, resolved_at = NOW(), siren_active = FALSE
       WHERE camera_id = $1 AND is_active = TRUE
       RETURNING *`,
      [reading.camera_id]
    );
    if (resolved.length) {
      try {
        const io = getIO();
        if (io) io.emit('alert:updated', { ...resolved[0], is_active: false });
      } catch (_) {}
    }
    return null;
  }

  const { rows: existing } = await db.query(
    `SELECT id, flood_level FROM flood_alerts
     WHERE camera_id = $1 AND is_active = TRUE LIMIT 1`,
    [reading.camera_id]
  );


  if (existing.length) {
    if (existing[0].flood_level === level) {
      // Level has not changed. Do not spam notifications.
      return null;
    }

    // Level changed, close the old alert.
    await db.query(
      `UPDATE flood_alerts
       SET is_active = FALSE, resolved_at = NOW(), siren_active = FALSE
       WHERE id = $1`,
      [existing[0].id]
    );
  }

  const sirenActive = SIREN_LEVELS.has(level);

  const { rows: [alert] } = await db.query(
    `INSERT INTO flood_alerts (camera_id, reading_id, flood_level, trigger_type, siren_active)
     VALUES ($1, $2, $3, 'THRESHOLD_BREACH', $4)
     RETURNING id`,
    [reading.camera_id, reading.id, level, sirenActive]
  );

  // calculate real estimated hours to critical flood
  const CRITICAL_LEVEL = 6.1;
  const currentLevel = parseFloat(reading.water_level_m);
  const { rows: trendRows } = await db.query(
    `SELECT water_level_m, captured_at
     FROM water_level_readings
     WHERE camera_id = $1 AND captured_at >= NOW() - INTERVAL '30 minutes'
     ORDER BY captured_at ASC LIMIT 10`,
    [reading.camera_id]
  );
  let estimatedHours = null;
  if (trendRows.length >= 2) {
    const oldest = parseFloat(trendRows[0].water_level_m);
    const newest = parseFloat(trendRows[trendRows.length - 1].water_level_m);
    const deltaM = newest - oldest;
    const deltaMin = (new Date(trendRows[trendRows.length - 1].captured_at) - new Date(trendRows[0].captured_at)) / 60000;
    const ratePerHour = deltaMin > 0 ? (deltaM / deltaMin) * 60 : 0;
    if (ratePerHour > 0.01) {
      const hoursLeft = (CRITICAL_LEVEL - currentLevel) / ratePerHour;
      estimatedHours = Math.max(0.1, parseFloat(hoursLeft.toFixed(1)));
    }
  }

  const roles = ESCALATION_MAP[level] || [];
  const messages = buildMessages(level);

  const { rows: recipients } = await db.query(
    `SELECT id, role, fcm_token, phone_number
     FROM users
     WHERE role = ANY($1::user_role[]) AND is_active = TRUE`,
    [roles]
  );

  const dispatches = [];

  for (const user of recipients) {
    const msg = RESPONDER_ROLES.has(user.role)
      ? messages.responder
      : user.role === 'CITIZEN'
        ? messages.resident
        : messages.mdrrmo;

    if (user.fcm_token) {
      dispatches.push([alert.id, 'FCM', user.role, user.fcm_token, msg, 'SENT']);
      const LEVEL_META = {
        MONITOR:    { title: '📢 MDRRMO ADVISORY: Monitor Level Reached', action: 'Please stay alert, secure essential belongings, and monitor official MDRRMO announcements.' },
        ALERT:      { title: '⚠️ MDRRMO WARNING: Alert Level Reached', action: 'Please prepare emergency kits, secure family members, and be ready to evacuate if instructed.' },
        EVACUATION: { title: '🚨 MDRRMO EMERGENCY: Mandatory Evacuation Level', action: 'MANDATORY EVACUATION: Please evacuate immediately to your designated evacuation center.' },
        CRITICAL:   { title: '🆘 MDRRMO CRITICAL DANGER: Critical Flood Level', action: 'CRITICAL DANGER: Evacuate NOW to high ground or designated centers! Call SOS if trapped.' },
      };
      const meta = LEVEL_META[level] || { title: `🚨 Water level has reached ${level} level.`, action: 'Please follow safety guidelines.' };
      const { calculatePredictiveForecast } = await import('../readings/readings.service.js');
      const predictive = await calculatePredictiveForecast(reading.camera_id, parseFloat(reading.water_level_m), 0, level);

      const forecastLine = level === 'CRITICAL'
        ? `CRITICAL DANGER: Water level is at ${parseFloat(reading.water_level_m).toFixed(2)}m.`
        : predictive.predictive_text;

      const { rows: centers } = await db.query(
        `SELECT ec.name, 
                (ec.capacity_total - ec.capacity_current) AS available_slots,
                b.name AS barangay_name,
                CASE WHEN ec.barangay_id = u.barangay_id THEN 0 ELSE 1 END AS distance_rank
         FROM evacuation_centers ec
         JOIN users u ON u.id = $1
         LEFT JOIN barangays b ON b.id = ec.barangay_id
         WHERE ec.is_open = TRUE 
           AND ec.capacity_current < ec.capacity_total
         ORDER BY distance_rank ASC, available_slots DESC 
         LIMIT 3`,
        [user.id]
      );
      const centerLines = centers.length
        ? centers.map(c => `• ${c.name} (${c.available_slots} slots)`).join('\n')
        : '• No open evacuation centers nearby.';
      const pushBody = `${forecastLine} ${meta.action}\n\nNearest open evacuation centers in your area:\n${centerLines}`;
      try {
        await sendPushNotification(user.fcm_token, meta.title, pushBody);
      } catch (fcmError) {
        console.error('[Alert] FCM notification failed:', fcmError.message);
      }
    }

    if (SMS_LEVELS.has(level) && user.phone_number) {
      dispatches.push([alert.id, 'SMS', user.role, user.phone_number, msg, 'SENT']);
    }
  }

  if (dispatches.length) {
    const vals = dispatches.map((_, i) => {
      const b = i * 6;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
    }).join(',');

    await db.query(
      `INSERT INTO alert_dispatches
         (alert_id, channel, recipient_role, recipient_ref, message_sent, status)
       VALUES ${vals}`,
      dispatches.flat()
    );
  }

  await writeAuditLog({
    action: 'ALERT_DISPATCHED',
    entityType: 'flood_alerts',
    entityId: alert.id,
    after: {
      level,
      siren_active: sirenActive,
      recipients: recipients.length,
    },
  });

  try {
    const io = getIO();
    if (io) {
      io.emit('alert:created', {
        id: alert.id,
        camera_id: reading.camera_id,
        reading_id: reading.id,
        flood_level: level,
        siren_active: sirenActive,
        is_active: true,
        triggered_at: new Date().toISOString(),
      });
    }
  } catch (_) {}

  return { alert_id: alert.id, level, siren_active: sirenActive };
};

export const getActive = async () => {
  const { rows } = await query(
    `SELECT a.*, c.location_name, c.lat, c.lng,
            b.name AS barangay_name, b.risk_level,
            r.water_level_m AS current_water_level_m
     FROM flood_alerts a
     JOIN cameras c ON c.id = a.camera_id
     LEFT JOIN barangays b ON b.id = c.barangay_id
     LEFT JOIN water_level_readings r ON r.id = a.reading_id
     WHERE a.is_active = TRUE
     ORDER BY a.triggered_at DESC`
  );

  // attach real rate_per_hour and predictive forecast to each alert
  const { calculatePredictiveForecast } = await import('../readings/readings.service.js');
  for (const alert of rows) {
    const { rows: trend } = await query(
      `SELECT water_level_m, captured_at
       FROM water_level_readings
       WHERE camera_id = $1 AND captured_at >= NOW() - INTERVAL '1 hour'
       ORDER BY captured_at ASC LIMIT 20`,
      [alert.camera_id]
    );
    if (trend.length >= 2) {
      let minIdx = 0;
      for (let i = 1; i < trend.length; i++) {
        if (parseFloat(trend[i].water_level_m) < parseFloat(trend[minIdx].water_level_m)) minIdx = i;
      }
      const from = trend[minIdx];
      const last = trend[trend.length - 1];
      const hours = (new Date(last.captured_at) - new Date(from.captured_at)) / 3600000;
      const delta = parseFloat(last.water_level_m) - parseFloat(from.water_level_m);
      alert.rate_per_hour = hours > 0 && delta > 0 ? parseFloat((delta / hours).toFixed(3)) : 0;
      alert.rise_start_at = from.captured_at;
    } else {
      alert.rate_per_hour = 0;
      alert.rise_start_at = null;
    }

    const current_m = parseFloat(alert.current_water_level_m || 0);
    const predictive = await calculatePredictiveForecast(alert.camera_id, current_m, alert.rate_per_hour, alert.flood_level);
    Object.assign(alert, predictive);
  }

  return rows;
};

export const getHistory = async (params) => {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(100, parseInt(params.limit || '20', 10));
  const offset = (page - 1) * limit;

  const { rows } = await query(
    `SELECT a.*, c.location_name,
            r.water_level_m, r.flood_level AS reading_flood_level
     FROM flood_alerts a
     JOIN cameras c ON c.id = a.camera_id
     LEFT JOIN water_level_readings r ON r.id = a.reading_id
     ORDER BY a.triggered_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
};

export const toggleSiren = async (alertId, sirenActive) => {
  const { rows } = await query(
    `UPDATE flood_alerts
     SET siren_active = $2
     WHERE id = $1 AND is_active = TRUE
     RETURNING *`,
    [alertId, sirenActive]
  );
  const updated = rows[0] || null;
  if (updated) {
    const io = getIO();
    if (io) io.emit('alert:updated', updated);
  }
  return updated;
};

export const triggerManualSiren = async (userId) => {
  // 1. Get any active camera to associate the alert with (fallback to first one)
  const { rows: cameras } = await query(`SELECT id FROM cameras LIMIT 1`);
  if (!cameras.length) throw new Error('No cameras configured to trigger alarm on.');

  // 2. Create a MANUAL CRITICAL alert
  const { rows: [alert] } = await query(
    `INSERT INTO flood_alerts (camera_id, flood_level, trigger_type, siren_active, is_active)
     VALUES ($1, 'CRITICAL', 'MANUAL', TRUE, TRUE)
     RETURNING id, flood_level, siren_active`,
    [cameras[0].id]
  );

  // Broadcast real-time socket event
  const io = getIO();
  if (io) io.emit('alert:updated', alert);

  // 3. Dispatch Push Notifications to all active users
  const { rows: recipients } = await query(
    `SELECT id, role, fcm_token FROM users WHERE is_active = TRUE AND fcm_token IS NOT NULL`
  );

  const pushBody = '🚨 A MANUAL EMERGENCY ALARM HAS BEEN TRIGGERED BY THE MDRRMO. PLEASE BE ON HIGH ALERT AND AWAIT FURTHER INSTRUCTIONS.';
  
  for (const user of recipients) {
    try {
      await sendPushNotification(user.fcm_token, '🚨 EMERGENCY SIREN TRIGGERED', pushBody);
    } catch (err) {
      console.error('[Alert] FCM notification failed for manual trigger:', err.message);
    }
  }

  // 4. Audit Log
  await writeAuditLog({
    action: 'MANUAL_SIREN_TRIGGERED',
    entityType: 'flood_alerts',
    entityId: alert.id,
    user_id: userId,
    after: {
      level: alert.flood_level,
      siren_active: alert.siren_active,
      recipients: recipients.length,
    },
  });

  return alert;
};

export const resolveAlert = async (alertId, userId, notes) => {
  const { rows } = await query(
    `UPDATE flood_alerts
     SET is_active = FALSE, resolved_at = NOW(),
         resolved_by = $2, siren_active = FALSE, notes = $3
     WHERE id = $1 AND is_active = TRUE
     RETURNING *`,
    [alertId, userId, notes || null]
  );
  const resolved = rows[0] || null;
  if (resolved) {
    const io = getIO();
    if (io) io.emit('alert:updated', resolved);
  }
  return resolved;
};