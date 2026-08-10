import * as service from './readings.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const ingest = asyncHandler(async (req, res) => {
  const reading = await service.ingestReading(req.camera.id, req.body);
  res.status(202).json({ success: true, data: reading });
});

export const getLatest = asyncHandler(async (req, res) => {
  const data = await service.getLatest(req.params.cameraId);
  res.json({ success: true, data });
});

export const getHistory = asyncHandler(async (req, res) => {
  const data = await service.getHistory(req.params.cameraId, req.query);
  res.json({ success: true, ...data });
});

export const getTrend = asyncHandler(async (req, res) => {
  const minutes = parseInt(req.query.minutes || '30', 10);
  const data    = await service.getTrend(req.params.cameraId, minutes);
  res.json({ success: true, data });
});