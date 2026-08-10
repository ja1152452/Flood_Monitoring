import { Router } from 'express';
import * as controller from './cameras.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createCameraSchema, updateCameraSchema, calibrationSchema,
} from './cameras.schema.js';
import Joi from 'joi';

const router = Router();

router.use(authenticate);

router.get('/',
  authorize('ADMIN', 'SUPER_ADMIN'),
  controller.getAll
);

router.post('/',
  authorize('SUPER_ADMIN'),
  validate(createCameraSchema),
  controller.create
);

router.get('/calibration/:cameraCode',
  authorize('ADMIN', 'SUPER_ADMIN'),
  controller.getCalibration
);

router.get('/:id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  controller.getById
);

router.patch('/:id',
  authorize('SUPER_ADMIN'),
  validate(updateCameraSchema),
  controller.update
);

router.patch('/:id/calibration',
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(calibrationSchema),
  controller.updateCalibration
);

router.put('/:id/thresholds',
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(Joi.object({
    thresholds: Joi.array().items(Joi.object({
      flood_level: Joi.string().valid('NORMAL','MONITOR','ALERT','EVACUATION','CRITICAL').required(),
      min_meters:  Joi.number().min(0).required(),
      max_meters:  Joi.number().min(0).required(),
    })).min(1).required(),
  })),
  controller.updateThresholds
);

export default router;