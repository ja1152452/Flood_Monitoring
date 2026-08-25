import { ApiError } from '../utils/ApiError.js';

const ROLE_LEVEL = {
  SUPER_ADMIN:       4,
  ADMIN:             3,
  MSWDO:             2,
  PNP:               2,
  BFP:               2,
  COAST_GUARD:       2,
  RHU:               2,
  MDRRMO:            2,
  MDRRMO_RESPONDER:  2,
  BARANGAY_OFFICIAL: 2,
  RESCUE:            2,
  CITIZEN:           1,
};

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  const userLevel = ROLE_LEVEL[req.user.role] ?? 0;
  const minLevel  = Math.min(...roles.map(r => ROLE_LEVEL[r] ?? 99));
  if (roles.length > 0 && !roles.includes(req.user.role) && userLevel < minLevel) {
    return next(ApiError.forbidden());
  }
  if (userLevel < minLevel) return next(ApiError.forbidden());
  next();
};