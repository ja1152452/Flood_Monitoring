import { Router } from 'express';
import * as controller from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, authenticateUnverified } from '../../middleware/auth.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema.js';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../../../uploads/avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${req.user.id}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login',    validate(loginSchema),    controller.login);
router.post('/refresh',  validate(refreshSchema),  controller.refresh);
router.get('/me',        authenticate,             controller.me);
router.post('/verify-email', authenticateUnverified, validate(Joi.object({ otp: Joi.string().length(6).required() })), controller.verifyEmail);
router.post('/resend-otp',   authenticateUnverified, controller.resendOtp);
router.patch('/fcm-token',
  authenticate,
  validate(Joi.object({ fcm_token: Joi.string().allow(null, '').optional() })),
  controller.updateFcmToken
);
router.post('/forgot-password',
  validate(Joi.object({ email: Joi.string().email({ tlds: { allow: false } }).required() })),
  controller.forgotPassword
);
router.post('/reset-password',
  validate(Joi.object({
    email:    Joi.string().email({ tlds: { allow: false } }).required(),
    otp:      Joi.string().length(6).required(),
    password: Joi.string().min(8).max(72).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
  })),
  controller.resetPassword
);
router.patch('/change-password',
  authenticate,
  validate(Joi.object({
    current_password: Joi.string().required(),
    new_password:     Joi.string().min(8).max(72).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
  })),
  controller.changePassword
);
router.patch('/profile',
  authenticate,
  validate(Joi.object({
    full_name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s.'-]+$/).optional().messages({
      'string.pattern.base': 'Full name must contain alphabetic letters and valid text symbols only',
    }),
    phone_number: Joi.string().pattern(/^09\d{9}$/).allow('', null).optional().messages({
      'string.pattern.base': 'Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)',
    }),
    barangay: Joi.string().allow('', null).optional(),
    barangay_id: Joi.string().uuid().allow('', null).optional(),
  })),
  controller.updateProfile
);
router.post('/avatar', authenticate, upload.single('avatar'), controller.uploadAvatar);

export default router;