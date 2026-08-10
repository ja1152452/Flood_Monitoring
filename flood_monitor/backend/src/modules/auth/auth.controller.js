import * as authService from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { ApiError } from '../../utils/ApiError.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  await writeAuditLog({ userId: result.user.id, action: 'USER_REGISTER', entityType: 'users', entityId: result.user.id, ip: req.ip });
  res.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  await writeAuditLog({ userId: result.user.id, action: 'USER_LOGIN', entityType: 'users', entityId: result.user.id, ip: req.ip });
  res.json({ success: true, data: result });
});

export const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refresh_token);
  res.json({ success: true, data: tokens });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.user.id, req.body.otp);
  res.json({ success: true, message: 'Email verified successfully' });
});

export const resendOtp = asyncHandler(async (req, res) => {
  await authService.resendOtp(req.user.id);
  res.json({ success: true, message: 'Verification code resent' });
});

export const updateFcmToken = asyncHandler(async (req, res) => {
  await authService.updateFcmToken(req.user.id, req.body.fcm_token);
  res.json({ success: true, message: 'FCM token updated' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  res.json({ success: true, message: 'If that email exists, a reset code was sent' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.email, req.body.otp, req.body.password);
  res.json({ success: true, message: 'Password reset successfully' });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body.current_password, req.body.new_password);
  res.json({ success: true, message: 'Password changed successfully' });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const data = await authService.updateProfile(req.user.id, req.body);
  res.json({ success: true, data });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const data = await authService.updateAvatar(req.user.id, req.file.filename);
  res.json({ success: true, data });
});