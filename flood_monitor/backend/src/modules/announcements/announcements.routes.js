import { Router } from 'express';
import * as service from './announcements.service.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import Joi from 'joi';
import { validate } from '../../middleware/validate.js';

const router = Router();
router.use(authenticate);

const createSchema = Joi.object({
  title:             Joi.string().max(255).required(),
  message:           Joi.string().required(),
  type:              Joi.string().valid('GENERAL','FLOOD_WARNING','EVACUATION_ORDER','ALL_CLEAR').optional(),
  target_roles:      Joi.array().items(Joi.string()).optional(),
  target_barangays:  Joi.array().items(Joi.string()).optional(),
  expires_at:        Joi.string().isoDate().optional(),
});

const ALL_ROLES = ['CITIZEN', 'RESCUE', 'ADMIN', 'SUPER_ADMIN', 'PNP', 'BFP', 'COAST_GUARD', 'RHU', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'MSWDO'];

router.get('/',
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const data = await service.getActive();
    res.json({ success: true, data });
  })
);

router.get('/all',
  authorize('ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.getAll();
    res.json({ success: true, data });
  })
);

router.post('/',
  authorize('ADMIN','SUPER_ADMIN'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const data = await service.create(req.user.id, req.body);
    res.status(201).json({ success: true, data });
  })
);

router.patch('/:id/deactivate',
  authorize('ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.deactivate(req.params.id, req.user.id);
    res.json({ success: true, data });
  })
);

export default router;