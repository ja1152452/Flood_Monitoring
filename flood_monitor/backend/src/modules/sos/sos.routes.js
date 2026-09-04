import { Router } from 'express';
import { query } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sosLimiter } from '../../middleware/rateLimiter.js';
import * as service from './sos.service.js';
import * as controller from './sos.controller.js';
import Joi from 'joi';

const router = Router();
router.use(authenticate);

const createSchema = Joi.object({
  lat:          Joi.number().min(-90).max(90).required(),
  lng:          Joi.number().min(-180).max(180).required(),
  message:      Joi.string().max(500).optional(),
  barangay_id:  Joi.string().uuid().optional(),
});

router.post('/',
  authorize('CITIZEN','RESCUE','RHU','PNP','BFP','COAST_GUARD','BARANGAY_OFFICIAL','ADMIN','SUPER_ADMIN','MDRRMO','MDRRMO_RESPONDER','MSWDO'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const data = await service.createSOS(req.user.id, req.body);
    res.status(201).json({ success: true, data });
  })
);

router.get('/mine',
  authorize('CITIZEN','RESCUE','RHU','PNP','BFP','COAST_GUARD','BARANGAY_OFFICIAL','ADMIN','SUPER_ADMIN','MDRRMO','MDRRMO_RESPONDER','MSWDO'),
  asyncHandler(async (req, res) => {
    const data = await service.getMine(req.user.id);
    res.json({ success: true, data });
  })
);

router.get('/pending',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.getPending(req.user);
    res.json({ success: true, data });
  })
);

router.get('/history',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.getHistory(req.user);
    res.json({ success: true, data });
  })
);


const dispatchSchema = Joi.object({
  responder_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
  notes:         Joi.string().max(500).optional().allow('', null),
  dispatch_type: Joi.string().valid('PRIMARY', 'BACKUP').optional().default('PRIMARY'),
});

router.patch('/:id/dispatch',
  authorize('ADMIN','SUPER_ADMIN','MDRRMO'),
  validate(dispatchSchema),
  controller.dispatch
);

router.patch('/:id/respond',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  controller.respond
);

router.patch('/:id/decline',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE'),
  controller.decline
);

router.patch('/:id/complete',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  controller.resolve
);

router.patch('/:id/cancel',
  authorize('CITIZEN'),
  asyncHandler(async (req, res) => {
    const data = await service.cancelSOS(req.user.id, req.params.id);
    res.json({ success: true, data });
  })
);

const backupSchema = Joi.object({
  sos_id:      Joi.string().uuid().optional().allow('', null),
  lat:         Joi.number().min(-90).max(90).required(),
  lng:         Joi.number().min(-180).max(180).required(),
  message:     Joi.string().max(300).optional().allow('', null),
  target_role: Joi.string().valid('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE').required(),
});

router.post('/backup',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  validate(backupSchema),
  asyncHandler(async (req, res) => {
    const data = await service.requestBackup(req.user.id, req.body);
    res.status(201).json({ success: true, data });
  })
);

router.get('/backup',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.getActiveBackups(req.user);
    res.json({ success: true, data });
  })
);

const dispatchBackupSchema = Joi.object({
  responder_id: Joi.string().uuid().required(),
  notes:        Joi.string().max(500).optional().allow('', null),
});

router.post('/backup/:id/dispatch',
  authorize('ADMIN', 'SUPER_ADMIN', 'MDRRMO'),
  validate(dispatchBackupSchema),
  asyncHandler(async (req, res) => {
    const data = await service.dispatchBackup(req.user, req.params.id, req.body.responder_id, req.body.notes);
    res.json({ success: true, data });
  })
);

router.patch('/backup/:id/resolve',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.resolveBackup(req.params.id, req.user.id);
    res.json({ success: true, data });
  })
);

router.get('/duty-status',
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { status: req.user.responder_status || 'AVAILABLE' } });
  })
);

router.all(['/duty-status'],
  authorize('PNP','BFP','COAST_GUARD','RHU','MDRRMO','MDRRMO_RESPONDER','BARANGAY_OFFICIAL','RESCUE','ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const status = req.body.status || 'AVAILABLE';
    await query(`UPDATE users SET responder_status = $2 WHERE id = $1`, [req.user.id, status]);
    res.json({ success: true, data: { status } });
  })
);

export default router;