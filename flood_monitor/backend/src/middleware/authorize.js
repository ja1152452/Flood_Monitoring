import { ApiError } from '../utils/ApiError.js';

const ROLE_LEVEL = {
  SUPER_ADMIN:       4,
  ADMIN:             3,
  MSWDO:             2,
  PNP:               2,
  BFP:               2,
  RHU:               2,
  MDRRMO:            2,
  BARANGAY_OFFICIAL: 2,
  RESCUE:            2, // legacy
  CITIZEN:           1,
};

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  const userLevel = ROLE_LEVEL[req.user.role] ?? 0;
  const minLevel  = Math.min(...roles.map(r => ROLE_LEVEL[r] ?? 99));
  if (userLevel < minLevel) return next(ApiError.forbidden());
  next();
};