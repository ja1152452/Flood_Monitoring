import * as service from './analytics.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getSummary = asyncHandler(async (_req, res) => {
  const data = await service.getSummary();
  res.json({ success: true, data });
});

export const getHourly = asyncHandler(async (req, res) => {
  const { cameraId, hours } = req.query;
  if (!cameraId) {
    return res.status(400).json({ success: false, message: 'cameraId is required' });
  }
  const data = await service.getHourlyData(cameraId, parseInt(hours || '24', 10));
  res.json({ success: true, data });
});

export const getAlertFrequency = asyncHandler(async (req, res) => {
  const data = await service.getAlertFrequency(parseInt(req.query.days || '30', 10));
  res.json({ success: true, data });
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const data = await service.getAuditLogs(req.query);
  res.json({ success: true, data });
});

export const getReadingTrend = asyncHandler(async (req, res) => {
  const { cameraId, minutes } = req.query;
  if (!cameraId) {
    return res.status(400).json({ success: false, message: 'cameraId is required' });
  }
  const data = await service.getReadingTrend(cameraId, parseInt(minutes || '60', 10));
  res.json({ success: true, data });
});