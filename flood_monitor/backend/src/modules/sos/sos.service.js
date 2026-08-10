import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { sendPushNotification } from '../../services/firebase.js';
import { getIO } from '../../config/socket.js';

const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'];

export const createSOS = async (userId, dto) => {
  const { rows: user } = await query(
    'SELECT full_name, phone_number, barangay_id FROM users WHERE id = $1',
    [userId]
  );

  const barangayId = dto.barangay_id || user[0]?.barangay_id || null;

  const { rows } = await query(
    `INSERT INTO sos_requests
       (user_id, barangay_id, lat, lng, message, victim_name, victim_contact, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING')
     RETURNING *`,
    [userId, barangayId, dto.lat, dto.lng,
     dto.message || null,
     user[0]?.full_name || null,
     user[0]?.phone_number || null]
  );
  const sos = rows[0];

  await writeAuditLog({
    userId, action: 'SOS_CREATED',
    entityType: 'sos_requests', entityId: sos.id,
    after: { lat: dto.lat, lng: dto.lng, barangay_id: barangayId },
  });

  // 1. Emergency Alert Notification (Awareness Only to ALL responders)
  const { rows: responders } = await query(
    `SELECT fcm_token FROM users
     WHERE role = ANY($1::user_role[]) AND is_active = TRUE AND fcm_token IS NOT NULL`,
    [RESPONDER_ROLES]
  );

  const notificationTitle = '🚨 Emergency Alert';
  const notificationBody  = 'New Rescue Request Received - Waiting for MDRRMO Dispatch.';

  Promise.allSettled(
    responders.map(r => sendPushNotification(r.fcm_token, notificationTitle, notificationBody))
  ).catch(() => {});

  const io = getIO();
  if (io) {
    io.emit('sos:created', sos);
  }

  return sos;
};

export const getPending = async (requestingUser) => {
  let whereClause = `WHERE s.status IN ('PENDING','ACKNOWLEDGED','DISPATCHED','RESPONDING')`;
  const params    = [];

  if (requestingUser.role === 'BARANGAY_OFFICIAL' && requestingUser.barangay_id) {
    whereClause += ` AND s.barangay_id = $1`;
    params.push(requestingUser.barangay_id);
  }

  const { rows } = await query(
    `SELECT s.*,
            u.full_name AS citizen_name,
            u.phone_number AS citizen_phone,
            b.name AS barangay_name,
            b.risk_level,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', d.id,
                    'responder_id', d.responder_id,
                    'full_name', ru.full_name,
                    'role', ru.role,
                    'phone_number', ru.phone_number,
                    'dispatch_type', COALESCE(d.dispatch_type, 'PRIMARY'),
                    'status', d.status,
                    'responder_duty_status', COALESCE(ru.responder_status, 'AVAILABLE'),
                    'dispatched_at', d.dispatched_at
                  )
                )
                FROM (
                  SELECT d.id, d.responder_id, d.dispatch_type, d.status, d.dispatched_at
                  FROM sos_dispatches d
                  WHERE d.sos_id = s.id AND d.status != 'DECLINED'

                  UNION

                  SELECT br.id, br.assigned_responder_id AS responder_id, 'BACKUP' AS dispatch_type, br.status, br.created_at AS dispatched_at
                  FROM backup_requests br
                  WHERE br.sos_id = s.id AND br.assigned_responder_id IS NOT NULL AND br.status IN ('DISPATCHED', 'ACCEPTED', 'RESOLVED')
                ) d
                JOIN users ru ON ru.id = d.responder_id
              ), '[]'::json
            ) AS dispatched_responders
     FROM sos_requests s
     LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN barangays b ON b.id = s.barangay_id
     ${whereClause}
     ORDER BY s.created_at DESC`,
    params
  );
  return rows;
};

export const getHistory = async (requestingUser) => {
  let whereClause = '';
  const params    = [];

  if (requestingUser.role === 'BARANGAY_OFFICIAL' && requestingUser.barangay_id) {
    whereClause = `WHERE s.barangay_id = $1`;
    params.push(requestingUser.barangay_id);
  }

  const { rows } = await query(
    `SELECT s.*,
            u.full_name AS citizen_name,
            u.phone_number AS citizen_phone,
            b.name AS barangay_name,
            b.risk_level,
            disp_user.full_name AS dispatched_by_name,
            disp_user.role AS dispatched_by_role,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', d.id,
                    'responder_id', d.responder_id,
                    'full_name', ru.full_name,
                    'role', ru.role,
                    'phone_number', ru.phone_number,
                    'dispatch_type', COALESCE(d.dispatch_type, 'PRIMARY'),
                    'status', d.status,
                    'dispatched_at', d.dispatched_at,
                    'completed_at', d.completed_at
                  )
                )
                FROM sos_dispatches d
                JOIN users ru ON ru.id = d.responder_id
                WHERE d.sos_id = s.id AND d.status != 'DECLINED'
              ), '[]'::json
            ) AS dispatched_responders
     FROM sos_requests s
     LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN barangays b ON b.id = s.barangay_id
     LEFT JOIN users disp_user ON disp_user.id = s.dispatched_by
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT 200`,
    params
  );
  return rows;
};


export const dispatchSOS = async (mdrrmoUser, sosId, responderIds = [], notes = '', dispatchType = 'PRIMARY') => {
  return withTransaction(async (client) => {
    // 1. Verify SOS exists
    const { rows: sosCheck } = await client.query(
      `SELECT s.*, b.name AS barangay_name
       FROM sos_requests s
       LEFT JOIN barangays b ON b.id = s.barangay_id
       WHERE s.id = $1`,
      [sosId]
    );
    if (!sosCheck.length) throw ApiError.notFound('Rescue request not found');

    const ids = Array.isArray(responderIds) ? responderIds : [responderIds];
    if (ids.length === 0) throw ApiError.badRequest('At least one responder must be selected for dispatch');

    // Requirement 7 Rules:
    // • Only responders with Available status may be selected as Primary or Backup.
    // • Responders already handling another rescue operation must NEVER be selected as backup until they become Available again.
    const { rows: targetResponders } = await client.query(
      `SELECT id, full_name, COALESCE(responder_status, 'AVAILABLE') AS responder_status
       FROM users WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    for (const r of targetResponders) {
      if (['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'UNAVAILABLE', 'OFF_DUTY'].includes(r.responder_status)) {
        throw ApiError.badRequest(
          `Responder ${r.full_name} is currently handling an active rescue operation ("Rescuing") and cannot be assigned as ${dispatchType} responder until their current operation is finished.`
        );
      }
    }

    // 2. Insert into sos_dispatches with dispatch_type (PRIMARY vs BACKUP)
    const typeLabel = dispatchType === 'BACKUP' ? 'BACKUP' : 'PRIMARY';

    for (const rid of ids) {
      await client.query(
        `INSERT INTO sos_dispatches (sos_id, responder_id, dispatched_by, dispatch_type, status, notes, dispatched_at)
         VALUES ($1, $2, $3, $4, 'DISPATCHED', $5, NOW())
         ON CONFLICT (sos_id, responder_id)
         DO UPDATE SET dispatch_type = EXCLUDED.dispatch_type, status = 'DISPATCHED', notes = EXCLUDED.notes, dispatched_at = NOW()`,
        [sosId, rid, mdrrmoUser.id, typeLabel, notes || null]
      );

      // Transition responder status to DISPATCHED
      await client.query(
        `UPDATE users SET responder_status = 'DISPATCHED' WHERE id = $1`,
        [rid]
      );
    }

    // 3. Update sos_requests status
    const primaryResponderId = ids[0];
    const { rows: updatedSOS } = await client.query(
      `UPDATE sos_requests
       SET status = 'DISPATCHED',
           assigned_rescue_id = COALESCE(assigned_rescue_id, $1),
           dispatched_by = $2,
           dispatched_at = NOW(),
           dispatch_notes = $3
       WHERE id = $4
       RETURNING *`,
      [primaryResponderId, mdrrmoUser.id, notes || null, sosId]
    );

    await writeAuditLog({
      userId: mdrrmoUser.id, action: `SOS_DISPATCHED_${typeLabel}`,
      entityType: 'sos_requests', entityId: sosId,
      after: { assigned_responders: ids, dispatch_type: typeLabel, notes },
    });

    // 4. Requirement 4 & 7: Official Dispatch Notification to backup/primary responders
    const { rows: assignedUsers } = await client.query(
      `SELECT fcm_token, full_name FROM users WHERE id = ANY($1::uuid[]) AND fcm_token IS NOT NULL`,
      [ids]
    );

    const title = `🚨 Official Dispatch Notification (${typeLabel} Responder)`;
    const body  = `You have been officially assigned as ${typeLabel} Responder to Rescue Request in ${sosCheck[0].barangay_name || 'Lumban'} by MDRRMO. Action required.`;

    Promise.allSettled(
      assignedUsers.map(u => sendPushNotification(u.fcm_token, title, body))
    ).catch(() => {});

    // Notify Resident (creator of SOS) that responder has been assigned
    const { rows: residentUser } = await client.query(
      `SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`,
      [sosCheck[0].user_id]
    );
    if (residentUser.length && residentUser[0].fcm_token) {
      const responderNames = assignedUsers.map(u => u.full_name).join(', ') || 'Rescue Team';
      sendPushNotification(
        residentUser[0].fcm_token,
        `🚨 Rescue Team Dispatched!`,
        `MDRRMO has assigned ${responderNames} to your request. Stay calm, help is on the way to your location!`
      ).catch(() => {});
    }

    // 5. Emit socket update
    const io = getIO();
    if (io) {
      io.emit('sos:dispatched', { sos_id: sosId, assigned_responder_ids: ids, dispatch_type: typeLabel, sos: updatedSOS[0] });
    }

    return updatedSOS[0];
  });
};

export const respondToSOS = async (rescueUser, sosId, targetState = 'EN_ROUTE') => {
  return withTransaction(async (client) => {
    const isMDRRMO = ['ADMIN', 'SUPER_ADMIN', 'MDRRMO'].includes(rescueUser.role);
    const nextDutyStatus = targetState === 'RESCUE_IN_PROGRESS' ? 'RESCUE_IN_PROGRESS' : 'EN_ROUTE';

    // Requirement 4 & 7: Automatically enroll responding responder in sos_dispatches if missing
    const { rows: check } = await client.query(
      `SELECT id FROM sos_dispatches WHERE sos_id = $1 AND responder_id = $2`,
      [sosId, rescueUser.id]
    );
    if (!check.length) {
      await client.query(
        `INSERT INTO sos_dispatches (sos_id, responder_id, dispatched_by, dispatch_type, status, responded_at)
         VALUES ($1, $2, $2, 'BACKUP', $3, NOW())
         ON CONFLICT (sos_id, responder_id)
         DO UPDATE SET status = EXCLUDED.status, responded_at = NOW()`,
        [sosId, rescueUser.id, nextDutyStatus]
      );
    } else {
      await client.query(
        `UPDATE sos_dispatches
         SET status = $3, responded_at = NOW()
         WHERE sos_id = $1 AND responder_id = $2`,
        [sosId, rescueUser.id, nextDutyStatus]
      );
    }

    // Update responder availability status & linked backup request
    await client.query(
      `UPDATE users SET responder_status = $2 WHERE id = $1`,
      [rescueUser.id, nextDutyStatus]
    );

    await client.query(
      `UPDATE backup_requests
       SET status = 'ACCEPTED', resolved_at = NOW()
       WHERE (sos_id = $1 OR assigned_responder_id = $2) AND status IN ('ACTIVE', 'DISPATCHED')`,
      [sosId, rescueUser.id]
    );

    const { rows } = await client.query(
      `UPDATE sos_requests
       SET status = 'RESPONDING',
           assigned_rescue_id = COALESCE(assigned_rescue_id, $1),
           responded_at = NOW()
       WHERE id = $2 AND status IN ('PENDING','ACKNOWLEDGED','DISPATCHED','RESPONDING')
       RETURNING *`,
      [rescueUser.id, sosId]
    );
    if (!rows.length) throw ApiError.notFound('SOS request not found');

    // Notify Resident that responder is EN_ROUTE or ON_SCENE
    const residentId = rows[0].user_id;
    if (residentId) {
      const { rows: residentToken } = await client.query(
        `SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`,
        [residentId]
      );
      if (residentToken.length && residentToken[0].fcm_token) {
        const resTitle = targetState === 'RESCUE_IN_PROGRESS' ? `📍 Rescue Unit On-Scene` : `🚑 Rescue Unit En Route`;
        const resBody  = targetState === 'RESCUE_IN_PROGRESS'
          ? `Responder ${rescueUser.full_name} (${rescueUser.role}) has arrived at your location.`
          : `Responder ${rescueUser.full_name} (${rescueUser.role}) is currently on the way to your location!`;
        sendPushNotification(residentToken[0].fcm_token, resTitle, resBody).catch(() => {});
      }
    }

    await writeAuditLog({
      userId: rescueUser.id, action: `SOS_RESPONDED_${nextDutyStatus}`,
      entityType: 'sos_requests', entityId: sosId,
    });

    const { rows: fullSos } = await client.query(
      `SELECT s.*,
              u.full_name AS citizen_name,
              u.phone_number AS citizen_phone,
              b.name AS barangay_name,
              b.risk_level,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'id', d.id,
                      'responder_id', d.responder_id,
                      'full_name', ru.full_name,
                      'role', ru.role,
                      'phone_number', ru.phone_number,
                      'dispatch_type', COALESCE(d.dispatch_type, 'PRIMARY'),
                      'status', d.status,
                      'responder_duty_status', COALESCE(ru.responder_status, 'AVAILABLE'),
                      'dispatched_at', d.dispatched_at
                    )
                  )
                  FROM (
                    SELECT d.id, d.responder_id, d.dispatch_type, d.status, d.dispatched_at
                    FROM sos_dispatches d
                    WHERE d.sos_id = s.id AND d.status != 'DECLINED'

                    UNION

                    SELECT br.id, br.assigned_responder_id AS responder_id, 'BACKUP' AS dispatch_type, br.status, br.created_at AS dispatched_at
                    FROM backup_requests br
                    WHERE br.sos_id = s.id AND br.assigned_responder_id IS NOT NULL AND br.status IN ('DISPATCHED', 'ACCEPTED', 'RESOLVED')
                  ) d
                  JOIN users ru ON ru.id = d.responder_id
                ), '[]'::json
              ) AS dispatched_responders
       FROM sos_requests s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN barangays b ON b.id = s.barangay_id
       WHERE s.id = $1`,
      [sosId]
    );

    const updatedRecord = fullSos[0] || rows[0];

    const io = getIO();
    if (io) {
      io.emit('sos:updated', updatedRecord);
    }

    return updatedRecord;
  });
};

export const declineSOS = async (rescueUser, sosId, reason = '') => {
  return withTransaction(async (client) => {
    // 1. Verify dispatch exists
    const { rows: check } = await client.query(
      `SELECT d.*, s.barangay_id, b.name AS barangay_name
       FROM sos_dispatches d
       JOIN sos_requests s ON s.id = d.sos_id
       LEFT JOIN barangays b ON b.id = s.barangay_id
       WHERE d.sos_id = $1 AND d.responder_id = $2`,
      [sosId, rescueUser.id]
    );
    if (!check.length) throw ApiError.notFound('Dispatch order not found for this user');

    // 2. Mark dispatch as DECLINED
    await client.query(
      `UPDATE sos_dispatches
       SET status = 'DECLINED', notes = $3
       WHERE sos_id = $1 AND responder_id = $2`,
      [sosId, rescueUser.id, reason || 'Declined by responder']
    );

    await client.query(
      `UPDATE backup_requests
       SET status = 'DECLINED', resolved_at = NOW()
       WHERE (sos_id = $1 OR assigned_responder_id = $2) AND status IN ('ACTIVE', 'DISPATCHED')`,
      [sosId, rescueUser.id]
    );

    // Requirement 6 & 7: Reset responder availability status back to AVAILABLE (Available Again)
    await client.query(
      `UPDATE users SET responder_status = 'AVAILABLE' WHERE id = $1`,
      [rescueUser.id]
    );

    // Check if any other active accepted/dispatched responders remain
    const { rows: remaining } = await client.query(
      `SELECT id FROM sos_dispatches WHERE sos_id = $1 AND status IN ('DISPATCHED','ACCEPTED')`,
      [sosId]
    );

    let updatedSOS = null;
    if (!remaining.length) {
      // Revert SOS request to PENDING (awaiting MDRRMO backup dispatch)
      const { rows } = await client.query(
        `UPDATE sos_requests SET status = 'PENDING', assigned_rescue_id = NULL WHERE id = $1 RETURNING *`,
        [sosId]
      );
      updatedSOS = rows[0];
    } else {
      const { rows } = await client.query(`SELECT * FROM sos_requests WHERE id = $1`, [sosId]);
      updatedSOS = rows[0];
    }

    await writeAuditLog({
      userId: rescueUser.id, action: 'SOS_DISPATCH_DECLINED',
      entityType: 'sos_requests', entityId: sosId,
      after: { reason },
    });

    // Notify MDRRMO for backup dispatch reassignment
    const io = getIO();
    if (io) {
      io.emit('sos:declined', { sos_id: sosId, responder: rescueUser, reason });
      if (updatedSOS) io.emit('sos:updated', updatedSOS);
    }

    const { rows: mdrrmoUsers } = await client.query(
      `SELECT fcm_token FROM users WHERE role IN ('ADMIN','SUPER_ADMIN','MDRRMO') AND fcm_token IS NOT NULL`
    );

    const title = '⚠️ Dispatch Declined — Backup Required';
    const body  = `Responder ${rescueUser.full_name} DECLINED dispatch for SOS in ${check[0].barangay_name || 'Lumban'}. MDRRMO backup dispatch required.`;

    Promise.allSettled(
      mdrrmoUsers.map(u => sendPushNotification(u.fcm_token, title, body))
    ).catch(() => {});

    return updatedSOS;
  });
};

export const completeRescue = async (rescueUser, sosId) => {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE sos_requests
       SET status = 'RESOLVED', resolved_at = NOW()
       WHERE id = $1 AND status IN ('DISPATCHED','RESPONDING')
       RETURNING *`,
      [sosId]
    );
    if (!rows.length) throw ApiError.notFound('SOS not found or not in active state');

    // Complete all dispatches for this SOS
    await client.query(
      `UPDATE sos_dispatches
       SET status = 'COMPLETED', completed_at = NOW()
       WHERE sos_id = $1`,
      [sosId]
    );

    // Requirement 6: Once Rescue Completed is confirmed, the responder automatically becomes Available!
    await client.query(
      `UPDATE users
       SET responder_status = 'AVAILABLE'
       WHERE id IN (SELECT responder_id FROM sos_dispatches WHERE sos_id = $1)
          OR id = $2`,
      [sosId, rescueUser.id]
    );

    await writeAuditLog({
      userId: rescueUser.id, action: 'SOS_RESCUE_COMPLETED',
      entityType: 'sos_requests', entityId: sosId,
    });

    const io = getIO();
    if (io) {
      io.emit('sos:updated', rows[0]);
    }

    return rows[0];
  });
};

export const cancelSOS = async (userId, sosId) => {
  const { rows: check } = await query(
    `SELECT * FROM sos_requests WHERE id = $1 AND user_id = $2`,
    [sosId, userId]
  );
  if (!check.length) throw ApiError.notFound('SOS request not found');

  const sos = check[0];
  if (['DISPATCHED', 'RESPONDING', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'RESOLVED'].includes(sos.status) || sos.dispatched_at || sos.assigned_rescue_id) {
    throw ApiError.badRequest('Cannot cancel SOS request once a rescue responder unit has been officially dispatched by MDRRMO.');
  }

  const { rows } = await query(
    `UPDATE sos_requests
     SET status = 'CANCELLED', resolved_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'PENDING'
     RETURNING *`,
    [sosId, userId]
  );
  if (!rows.length) throw ApiError.badRequest('SOS request cannot be cancelled at this stage.');

  await writeAuditLog({
    userId, action: 'SOS_CANCELLED',
    entityType: 'sos_requests', entityId: sosId,
  });

  const io = getIO();
  if (io) io.emit('sos:updated', rows[0]);
  
  return rows[0];
};

export const getMine = async (userId) => {
  const { rows } = await query(
    `SELECT s.*, b.name AS barangay_name,
            u.full_name AS assigned_responder_name, u.role AS assigned_responder_role,
            u.phone_number AS assigned_responder_phone, u.last_lat AS assigned_responder_lat,
            u.last_lng AS assigned_responder_lng, u.last_location_at AS assigned_responder_last_location_at,
            u.responder_status AS assigned_responder_status
     FROM sos_requests s
     LEFT JOIN barangays b ON b.id = s.barangay_id
     LEFT JOIN users u ON u.id = s.assigned_rescue_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 20`,
    [userId]
  );

  for (let sos of rows) {
    const { rows: dispatches } = await query(
      `SELECT d.id AS dispatch_id, d.dispatch_type, d.status AS dispatch_status, d.dispatched_at,
              u.id, u.full_name, u.role, u.phone_number, u.last_lat, u.last_lng, u.last_location_at, u.responder_status
       FROM sos_dispatches d
       JOIN users u ON u.id = d.responder_id
       WHERE d.sos_id = $1 AND d.status != 'DECLINED'
       ORDER BY d.dispatched_at ASC`,
      [sos.id]
    );
    sos.dispatched_responders = dispatches;

    if (!sos.assigned_responder_name && dispatches.length > 0) {
      sos.assigned_responder_name = dispatches[0].full_name;
      sos.assigned_responder_role = dispatches[0].role;
      sos.assigned_responder_phone = dispatches[0].phone_number;
      sos.assigned_responder_lat = dispatches[0].last_lat;
      sos.assigned_responder_lng = dispatches[0].last_lng;
      sos.assigned_responder_last_location_at = dispatches[0].last_location_at;
      sos.assigned_responder_status = dispatches[0].responder_status;
    }
  }

  return rows;
};

export const requestBackup = async (requesterId, dto) => {
  const { rows: requester } = await query(
    'SELECT full_name, role FROM users WHERE id = $1',
    [requesterId]
  );
  if (!requester.length) throw ApiError.notFound('User not found');

  const { sos_id, lat, lng, message, target_role } = dto;
  const requesterName = requester[0].full_name;
  const requesterRole = requester[0].role;

  const { rows } = await query(
    `INSERT INTO backup_requests (requester_id, sos_id, lat, lng, message, target_role, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
     RETURNING *`,
    [requesterId, sos_id || null, lat, lng, message || null, target_role || null]
  );
  const backup = rows[0];

  const { rows: responders } = await query(
    `SELECT fcm_token FROM users
     WHERE (role = $1 OR role IN ('ADMIN','SUPER_ADMIN','MDRRMO'))
       AND is_active = TRUE AND id != $2 AND fcm_token IS NOT NULL`,
    [target_role, requesterId]
  );

  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
  const body    = `${message || 'Backup needed.'} ${mapsUrl}`;

  Promise.allSettled(
    responders.map(r =>
      sendPushNotification(
        r.fcm_token,
        `🚨 BACKUP REQUEST from ${requesterRole} — ${requesterName}`,
        body
      )
    )
  ).catch(() => {});

  const io = getIO();
  if (io) io.emit('backup:created', backup);

  await writeAuditLog({
    userId: requesterId, action: 'BACKUP_REQUESTED',
    entityType: 'backup_requests', entityId: backup.id,
    after: { sos_id, lat, lng, message, target_role },
  });

  return backup;
};

export const getActiveBackups = async (requestingUser) => {
  const { rows } = await query(
    `SELECT br.*, 
            u.full_name AS requester_name, u.role AS requester_role, u.phone_number AS requester_phone,
            assigned_u.full_name AS assigned_responder_name, assigned_u.role AS assigned_responder_role,
            COALESCE(s.victim_name, u_victim.full_name) AS victim_name, s.lat AS sos_lat, s.lng AS sos_lng, s.status AS sos_status
     FROM backup_requests br
     JOIN users u ON u.id = br.requester_id
     LEFT JOIN users assigned_u ON assigned_u.id = br.assigned_responder_id
     LEFT JOIN sos_requests s ON s.id = br.sos_id
     LEFT JOIN users u_victim ON u_victim.id = s.user_id
     WHERE br.status IN ('ACTIVE', 'DISPATCHED')
     ORDER BY br.created_at DESC`,
  );
  return rows;
};

export const dispatchBackup = async (mdrrmoUser, backupId, responderId, notes = '') => {
  return withTransaction(async (client) => {
    const { rows: backupCheck } = await client.query(
      `SELECT br.*, u.full_name AS requester_name, u.role AS requester_role
       FROM backup_requests br
       JOIN users u ON u.id = br.requester_id
       WHERE br.id = $1 AND br.status = 'ACTIVE'`,
      [backupId]
    );
    if (!backupCheck.length) throw ApiError.notFound('Active backup request not found');
    const backup = backupCheck[0];

    const { rows: targetUsers } = await client.query(
      `SELECT id, full_name, role, fcm_token, COALESCE(responder_status, 'AVAILABLE') AS responder_status
       FROM users WHERE id = $1`,
      [responderId]
    );
    if (!targetUsers.length) throw ApiError.notFound('Responder not found');
    const responder = targetUsers[0];

    if (['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'UNAVAILABLE', 'OFF_DUTY'].includes(responder.responder_status)) {
      throw ApiError.badRequest(`Responder ${responder.full_name} is currently ${responder.responder_status} and cannot be assigned as backup.`);
    }

    if (backup.target_role && responder.role !== backup.target_role) {
      throw ApiError.badRequest(`Responder ${responder.full_name} is ${responder.role}, but backup request specifically requires ${backup.target_role}.`);
    }

    const { rows: updatedBackup } = await client.query(
      `UPDATE backup_requests
       SET status = 'DISPATCHED', assigned_responder_id = $1, resolved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [responderId, backupId]
    );

    let targetSosId = backup.sos_id;
    if (!targetSosId) {
      const { rows: newSos } = await client.query(
        `INSERT INTO sos_requests (user_id, victim_name, lat, lng, message, status, assigned_rescue_id, dispatched_by, dispatched_at, dispatch_notes)
         VALUES ($1, $2, $3, $4, $5, 'DISPATCHED', $6, $7, NOW(), $8)
         RETURNING *`,
        [
          backup.requester_id,
          `${backup.requester_role} (${backup.requester_name})`,
          backup.lat,
          backup.lng,
          backup.message || `Field backup requested by ${backup.requester_name}`,
          responderId,
          mdrrmoUser.id,
          notes || `Backup requested by ${backup.requester_name}`
        ]
      );
      targetSosId = newSos[0].id;
      await client.query(`UPDATE backup_requests SET sos_id = $1 WHERE id = $2`, [targetSosId, backupId]);
    }

    await client.query(
      `INSERT INTO sos_dispatches (sos_id, responder_id, dispatched_by, dispatch_type, status, notes, dispatched_at)
       VALUES ($1, $2, $3, 'BACKUP', 'DISPATCHED', $4, NOW())
       ON CONFLICT (sos_id, responder_id)
       DO UPDATE SET dispatch_type = 'BACKUP', status = 'DISPATCHED', notes = EXCLUDED.notes, dispatched_at = NOW()`,
      [targetSosId, responderId, mdrrmoUser.id, notes || `Backup requested by ${backup.requester_name}`]
    );

    await client.query(
      `UPDATE sos_requests
       SET status = 'DISPATCHED', dispatched_by = $1, dispatched_at = NOW()
       WHERE id = $2`,
      [mdrrmoUser.id, targetSosId]
    );

    await client.query(
      `UPDATE users SET responder_status = 'DISPATCHED' WHERE id = $1`,
      [responderId]
    );

    if (responder.fcm_token) {
      const title = `🚨 BACKUP DISPATCH ASSIGNMENT (${backup.target_role || 'BACKUP'})`;
      const body  = `MDRRMO has officially assigned you to assist ${backup.requester_role} ${backup.requester_name}. Location details available in app.`;
      sendPushNotification(responder.fcm_token, title, body).catch(() => {});
    }

    if (backup.sos_id) {
      const { rows: sosRecord } = await client.query(
        `SELECT user_id FROM sos_requests WHERE id = $1`,
        [backup.sos_id]
      );
      if (sosRecord.length) {
        const { rows: residentUser } = await client.query(
          `SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`,
          [sosRecord[0].user_id]
        );
        if (residentUser.length && residentUser[0].fcm_token) {
          sendPushNotification(
            residentUser[0].fcm_token,
            `🚨 Backup Rescue Team Dispatched!`,
            `An additional backup responder (${responder.full_name} - ${responder.role}) has been dispatched by MDRRMO to assist your location.`
          ).catch(() => {});
        }
      }
    }

    await writeAuditLog({
      userId: mdrrmoUser.id, action: 'BACKUP_DISPATCHED',
      entityType: 'backup_requests', entityId: backupId,
      after: { responderId, sos_id: backup.sos_id, notes },
    });

    const io = getIO();
    if (io) {
      io.emit('backup:dispatched', {
        backup: updatedBackup[0],
        responder: { id: responder.id, full_name: responder.full_name, role: responder.role },
        sos_id: backup.sos_id
      });
    }

    return updatedBackup[0];
  });
};

export const resolveBackup = async (backupId, userId) => {
  const { rows } = await query(
    `UPDATE backup_requests SET status = 'RESOLVED', resolved_at = NOW()
     WHERE id = $1 RETURNING *`,
    [backupId]
  );
  if (!rows.length) {
    return { id: backupId, status: 'RESOLVED', message: 'Backup request cleared' };
  }
  await writeAuditLog({
    userId, action: 'BACKUP_RESOLVED',
    entityType: 'backup_requests', entityId: backupId,
  }).catch(() => {});

  const io = getIO();
  if (io) io.emit('backup:resolved', rows[0]);

  return rows[0];
};