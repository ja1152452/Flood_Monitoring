import { Router }        from 'express';
import path              from 'path';
import fs                from 'fs';
import jwt               from 'jsonwebtoken';
import { authenticate }  from '../../middleware/auth.js';
import { asyncHandler }  from '../../utils/asyncHandler.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { getStreamStatus, startHLS, stopHLS } from '../../services/stream/hls.service.js';
import { getSimulationState, setSimulationState, resetSimulationState } from '../../services/simulation.service.js';
import { fileURLToPath } from 'url';
import { getIO }         from '../../config/socket.js';
import { query }         from '../../config/db.js';
import { sendPushNotification } from '../../services/firebase.js';

const getHlsDir = () => {
  const envDir = process.env.HLS_OUTPUT_DIR;
  if (envDir) {
    const resolved = path.resolve(envDir);
    if (fs.existsSync(path.dirname(resolved))) return resolved;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../hls');
};

const extractUserId = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lumban_flood_monitor_jwt_secret_key_2024');
      return decoded.sub;
    }
  } catch {}
  return null;
};

const router = Router();

router.get('/status', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: getStreamStatus() });
}));

router.get('/simulation', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: getSimulationState() });
}));

router.post('/simulation', asyncHandler(async (req, res) => {
  const previousState = getSimulationState();
  const updated = setSimulationState(req.body);
  const userId = extractUserId(req);

  // Write audit log if simulation active state changed
  if (!previousState.active && updated.active) {
    await writeAuditLog({
      userId,
      action: 'SIMULATION_STARTED',
      entityType: 'FLOOD_SIMULATION',
      after: {
        water_level_m: updated.water_level_m,
        flood_level: updated.flood_level,
        is_rising: updated.is_rising,
      },
      ip: req.ip,
    });
  } else if (previousState.active && !updated.active) {
    await writeAuditLog({
      userId,
      action: 'SIMULATION_STOPPED',
      entityType: 'FLOOD_SIMULATION',
      before: {
        water_level_m: previousState.water_level_m,
        flood_level: previousState.flood_level,
      },
      ip: req.ip,
    });
  }

  // Emit Real-time Socket & Push notification events when simulation flood level changes
  if (updated.active && previousState.flood_level !== updated.flood_level) {
    try {
      const io = getIO();
      if (io) {
        if (updated.flood_level !== 'NORMAL') {
          io.emit('alert:created', {
            id: `sim_alert_${updated.flood_level.toLowerCase()}`,
            camera_id: 'sim-camera',
            flood_level: updated.flood_level,
            siren_active: ['MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'].includes(updated.flood_level),
            is_active: true,
            is_simulated: true,
            triggered_at: updated.updated_at,
          });
        } else {
          io.emit('alert:updated', {
            id: `sim_alert_${previousState.flood_level?.toLowerCase() || 'resolved'}`,
            is_active: false,
            is_simulated: true,
            resolved_at: updated.updated_at,
          });
        }
      }
    } catch (_) {}

    // Dispatch FCM Push Notification to registered mobile devices
    if (updated.flood_level && updated.flood_level !== 'NORMAL') {
      try {
        const LEVEL_META = {
          MONITOR:    { title: '📢 [SIMULATION] MDRRMO ADVISORY: Monitor Level Reached', action: 'Please stay alert, secure essential belongings, and monitor official MDRRMO announcements.' },
          ALERT:      { title: '⚠️ [SIMULATION] MDRRMO WARNING: Alert Level Reached', action: 'Please prepare emergency kits, secure family members, and be ready to evacuate if instructed.' },
          EVACUATION: { title: '🚨 [SIMULATION] MDRRMO EMERGENCY: Mandatory Evacuation Level', action: 'MANDATORY EVACUATION: Please evacuate immediately to your designated evacuation center.' },
          CRITICAL:   { title: '🆘 [SIMULATION] MDRRMO CRITICAL DANGER: Critical Flood Level', action: 'CRITICAL DANGER: Evacuate NOW to high ground or designated centers! Call SOS if trapped.' },
        };
        const meta = LEVEL_META[updated.flood_level];
        if (meta) {
          const { rows: recipients } = await query(
            `SELECT id, role, fcm_token FROM users WHERE is_active = TRUE AND fcm_token IS NOT NULL`
          );
          const pushBody = `Water level has reached ${parseFloat(updated.water_level_m || 2.0).toFixed(2)}m (${updated.flood_level}). ${meta.action}`;
          for (const user of recipients) {
            try {
              await sendPushNotification(user.fcm_token, meta.title, pushBody);
            } catch (_) {}
          }
        }
      } catch (pushErr) {
        console.warn('[Simulation Push Notification Error]:', pushErr.message);
      }
    }
  }

  res.json({ success: true, data: updated });
}));

router.post('/simulation/reset', asyncHandler(async (req, res) => {
  const previousState = getSimulationState();
  const reset = resetSimulationState();
  const userId = extractUserId(req);

  try {
    const io = getIO();
    if (io && previousState.flood_level && previousState.flood_level !== 'NORMAL') {
      io.emit('alert:updated', {
        id: `sim_alert_${previousState.flood_level.toLowerCase()}`,
        is_active: false,
        is_simulated: true,
        resolved_at: new Date().toISOString(),
      });
    }
  } catch (_) {}

  await writeAuditLog({
    userId,
    action: 'SIMULATION_RESET',
    entityType: 'FLOOD_SIMULATION',
    after: { water_level_m: 2.00, flood_level: 'NORMAL' },
    ip: req.ip,
  });
  res.json({ success: true, data: reset });
}));

router.post('/simulation/audit-log', asyncHandler(async (req, res) => {
  const userId = extractUserId(req);
  const { action, details, entityId } = req.body;
  await writeAuditLog({
    userId,
    action: action || 'SIMULATION_EVENT',
    entityType: 'FLOOD_SIMULATION',
    entityId: entityId || null,
    after: details || {},
    ip: req.ip,
  });
  res.json({ success: true });
}));

router.post('/start',
  authenticate,
  asyncHandler(async (_req, res) => {
    startHLS();
    res.json({ success: true, message: 'Stream started' });
  })
);

router.post('/stop',
  authenticate,
  asyncHandler(async (_req, res) => {
    stopHLS();
    res.json({ success: true, message: 'Stream stopped' });
  })
);

router.get('/index.m3u8', (req, res) => {
  const hlsDir = getHlsDir();
  const file = path.join(hlsDir, 'stream.m3u8');
  if (!fs.existsSync(file)) {
    return res.status(404).json({ success: false, message: 'Stream not ready' });
  }
  res.setHeader('Content-Type',                'application/vnd.apple.mpegurl');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control',               'no-cache');
  res.sendFile(file);
});

// In-memory latest snapshot
let latestSnapshot = null;
let latestSnapshotAt = null;

export const setSnapshot = (jpegBuffer, capturedAt) => {
  latestSnapshot   = jpegBuffer;
  latestSnapshotAt = capturedAt;
};

router.post('/snapshot',
  asyncHandler(async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).end();
    const { query } = await import('../../config/db.js');
    const { rows } = await query(
      `SELECT id FROM cameras WHERE camera_code = 'CAM-LUMBAN-01' AND is_active = TRUE`
    );
    if (!rows.length) return res.status(401).end();

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      setSnapshot(Buffer.concat(chunks), new Date().toISOString());
      res.status(204).end();
    });
  })
);

router.get('/snapshot', (req, res) => {
  if (!latestSnapshot) return res.status(404).end();
  res.setHeader('Content-Type',  'image/jpeg');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Captured-At', latestSnapshotAt || '');
  res.end(latestSnapshot);
});

router.get('/:segment', (req, res) => {
  if (!req.params.segment.endsWith('.ts')) {
    return res.status(400).end();
  }
  const hlsDir = getHlsDir();
  const file = path.join(hlsDir, req.params.segment);
  if (!fs.existsSync(file)) {
    return res.status(404).end();
  }
  res.setHeader('Content-Type',                'video/MP2T');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control',               'no-cache');
  res.sendFile(file, (err) => {
    if (err && !res.headersSent) {
      res.status(404).end();
    }
  });
});

export default router;