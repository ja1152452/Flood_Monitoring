import { Router }        from 'express';
import path              from 'path';
import fs                from 'fs';
import { authenticate }  from '../../middleware/auth.js';
import { asyncHandler }  from '../../utils/asyncHandler.js';
import { getStreamStatus, startHLS, stopHLS } from '../../services/stream/hls.service.js';
import { getSimulationState, setSimulationState, resetSimulationState } from '../../services/simulation.service.js';
import { fileURLToPath } from 'url';

const getHlsDir = () => {
  const envDir = process.env.HLS_OUTPUT_DIR;
  if (envDir) {
    const resolved = path.resolve(envDir);
    if (fs.existsSync(path.dirname(resolved))) return resolved;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../hls');
};

const router = Router();

router.get('/status', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: getStreamStatus() });
}));

router.get('/simulation', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: getSimulationState() });
}));

router.post('/simulation', asyncHandler(async (req, res) => {
  const updated = setSimulationState(req.body);
  res.json({ success: true, data: updated });
}));

router.post('/simulation/reset', asyncHandler(async (_req, res) => {
  const reset = resetSimulationState();
  res.json({ success: true, data: reset });
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