import * as service from './cameras.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body, req.user.id);
  res.status(201).json({ success: true, data });
});

export const getAll = asyncHandler(async (_req, res) => {
  const data = await service.getAll();
  res.json({ success: true, data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, data });
});

export const getCalibration = asyncHandler(async (req, res) => {
  const data = await service.getCalibration(req.params.cameraCode);
  res.json({ success: true, data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.params.id, req.body, req.user.id);
  res.json({ success: true, data });
});

export const updateCalibration = asyncHandler(async (req, res) => {
  const data = await service.updateCalibration(req.params.id, req.body, req.user.id);
  res.json({ success: true, data });
});

export const updateThresholds = asyncHandler(async (req, res) => {
  await service.updateThresholds(req.params.id, req.body.thresholds, req.user.id);
  res.json({ success: true, message: 'Thresholds updated' });
});