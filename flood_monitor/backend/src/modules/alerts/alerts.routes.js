import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as service from './alerts.service.js';

const router = Router();
router.use(authenticate);

const ALL_ROLES = ['CITIZEN', 'RESCUE', 'ADMIN', 'SUPER_ADMIN', 'PNP', 'BFP', 'COAST_GUARD', 'RHU', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'MSWDO'];

router.get('/active',
  authorize(...ALL_ROLES),
  asyncHandler(async (_req, res) => {
    const data = await service.getActive();
    res.json({ success: true, data });
  })
);

router.post('/manual',
  authorize('ADMIN','SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.triggerManualSiren(req.user.id);
    res.json({ success: true, data });
  })
);

router.get('/history',
  authorize(...ALL_ROLES),
  asyncHandler(async (req, res) => {
    const data = await service.getHistory(req.query);
    res.json({ success: true, data });
  })
);

router.patch('/:id/resolve',
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.resolveAlert(req.params.id, req.user.id, req.body.notes);
    if (!data) throw ApiError.notFound('Active alert not found');
    res.json({ success: true, data });
  })
);

router.patch('/:id/siren',
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const data = await service.toggleSiren(req.params.id, req.body.siren_active);
    if (!data) throw ApiError.notFound('Active alert not found');
    res.json({ success: true, data });
  })
);

export default router;