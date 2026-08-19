import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const raw    = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!raw) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(raw, process.env.JWT_SECRET || 'lumban_flood_monitor_jwt_secret_key_2024');
  } catch {
    throw ApiError.unauthorized('Token invalid or expired');
  }

  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.full_name, u.is_active,
            u.phone_number, u.avatar_url, u.barangay_id,
            b.name AS barangay_name
     FROM users u
     LEFT JOIN barangays b ON b.id = u.barangay_id
     WHERE u.id = $1`,
    [payload.sub]
  );

  if (!rows.length || !rows[0].is_active) {
    throw ApiError.unauthorized('Account not found or deactivated');
  }

  req.user = rows[0];
  next();
});

// Same as authenticate but allows inactive users (used for email verification)
export const authenticateUnverified = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const raw    = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!raw) {
    if (req.body?.email) return next();
    throw ApiError.unauthorized('Authentication token or email is required');
  }
  let payload;
  try {
    payload = jwt.verify(raw, process.env.JWT_SECRET || 'lumban_flood_monitor_jwt_secret_key_2024');
  } catch {
    if (req.body?.email) return next();
    throw ApiError.unauthorized('Token invalid or expired');
  }

  const { rows } = await query(
    'SELECT id, email, role, full_name, is_active FROM users WHERE id = $1',
    [payload.sub]
  );

  if (!rows.length) {
    if (req.body?.email) return next();
    throw ApiError.unauthorized('Account not found');
  }

  req.user = rows[0];
  next();
});

export const authenticateCamera = asyncHandler(async (req, _res, next) => {
  const apiKey     = req.headers['x-api-key'];
  const cameraCode = req.body?.camera_code;
  if (!apiKey)     throw ApiError.unauthorized('Missing API key');
  if (!cameraCode) throw ApiError.unauthorized('Missing camera_code');

  const { rows } = await query(
    `SELECT id, camera_code, api_key_hash, is_active
     FROM cameras
     WHERE camera_code = $1 AND is_active = TRUE`,
    [cameraCode]
  );

  if (!rows.length) throw ApiError.unauthorized('Camera not found or inactive');

  const valid = await bcrypt.compare(apiKey, rows[0].api_key_hash);
  if (!valid) throw ApiError.unauthorized('Invalid API key');

  req.camera = rows[0];
  next();
});