import { Router } from 'express';
import * as controller from './analytics.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/summary',         controller.getSummary);
router.get('/hourly',          controller.getHourly);
router.get('/alert-frequency', controller.getAlertFrequency);
router.get('/audit-logs',        controller.getAuditLogs);
router.post('/audit-logs',       controller.createAuditLog);
router.put('/audit-logs/:id',    controller.updateAuditLog);
router.delete('/audit-logs/:id', controller.deleteAuditLog);
router.get('/trend',             controller.getReadingTrend);

export default router;