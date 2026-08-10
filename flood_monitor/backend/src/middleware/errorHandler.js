import { ApiError } from '../utils/ApiError.js';

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors:  err.errors.length ? err.errors : undefined,
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Already exists' });
  }

  if (err.code === '23503') {
    const isDelete = req.method === 'DELETE';
    const message = isDelete
      ? 'Cannot permanently delete this user account because they have linked activity (SOS dispatches, audit logs, or assigned centers). Please deactivate the user instead.'
      : 'Referenced record not found';
    return res.status(400).json({ success: false, message });
  }

  console.error('[Unhandled Error]', err);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' ? { detail: err.message, stack: err.stack } : {}),
  });
};