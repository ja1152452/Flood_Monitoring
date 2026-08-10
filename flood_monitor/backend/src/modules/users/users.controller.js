import * as service from './users.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getAll = asyncHandler(async (req, res) => {
  const data = await service.getAll(req.query);
  res.json({ success: true, ...data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.params.id);
  res.json({ success: true, data });
});

export const updateRole = asyncHandler(async (req, res) => {
  const data = await service.updateRole(req.params.id, req.body.role, req.user.id);
  res.json({ success: true, data });
});

export const setActive = asyncHandler(async (req, res) => {
  const data = await service.setActive(req.params.id, req.body.is_active, req.user.id);
  res.json({ success: true, data });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await service.resetPassword(req.params.id, req.body.new_password, req.user.id);
  res.json({ success: true, message: 'Password reset successfully' });
});