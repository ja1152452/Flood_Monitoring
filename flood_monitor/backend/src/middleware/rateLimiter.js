import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many login attempts' },
});

export const sosLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      3,
  message:  { success: false, message: 'Too many SOS requests' },
});