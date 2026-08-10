import * as service from './evacuation.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getAll = asyncHandler(async (req, res) => {
  const onlyOpen = req.query.open === 'true';
  const data = await service.getAll(onlyOpen);
  res.json({ success: true, data });
});

export const getNearest = asyncHandler(async (req, res) => {
  const { lat, lng, limit } = req.query;
  const data = await service.getNearest(
    parseFloat(lat), parseFloat(lng), parseInt(limit || '5', 10)
  );
  res.json({ success: true, data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.body, req.user.id);
  res.status(201).json({ success: true, data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.params.id, req.body, req.user.id);
  res.json({ success: true, data });
});

export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req.user.id);
  res.json({ success: true, message: 'Deleted' });
});