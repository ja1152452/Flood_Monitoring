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

export const createAuditLog = asyncHandler(async (req, res) => {
  const {
    action,
    description,
    summary,
    notes,
    severity,
    createdAt,
    userId,
    entityType,
    entityId,
    beforeState,
    afterState,
  } = req.body;

  if (!action) {
    return res.status(400).json({ success: false, message: 'Action type is required' });
  }

  const primarySummary = (summary || description || '').trim();
  if (!primarySummary) {
    return res.status(400).json({ success: false, message: 'Primary summary headline is required' });
  }

  const log = await service.createAuditLog({
    userId: userId || req.user?.id || null,
    action,
    description: primarySummary,
    notes: (notes || '').trim(),
    severity: severity || 'NORMAL',
    entityType: entityType || 'General',
    entityId: entityId || null,
    beforeState,
    afterState,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    createdAt,
    isManual: true,
  });
  res.status(201).json({ success: true, data: log });
});

export const updateAuditLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    action,
    description,
    summary,
    notes,
    severity,
    createdAt,
    userId,
    entityType,
    entityId,
    beforeState,
    afterState,
  } = req.body;

  const log = await service.updateAuditLog(id, {
    userId,
    action,
    description: summary !== undefined ? summary : description,
    notes,
    severity,
    entityType,
    entityId,
    beforeState,
    afterState,
    createdAt,
  });
  res.json({ success: true, data: log });
});

export const deleteAuditLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await service.deleteAuditLog(id);
  res.json({ success: true, message: 'Audit log deleted successfully' });
});

export const getReadingTrend = asyncHandler(async (req, res) => {
  const { cameraId, minutes } = req.query;
  if (!cameraId) {
    return res.status(400).json({ success: false, message: 'cameraId is required' });
  }
  const data = await service.getReadingTrend(cameraId, parseInt(minutes || '60', 10));
  res.json({ success: true, data });
});