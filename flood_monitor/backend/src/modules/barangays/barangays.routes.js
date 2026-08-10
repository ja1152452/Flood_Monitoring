import { Router } from 'express';
import { query } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await query(
    'SELECT * FROM barangays ORDER BY risk_level, name'
  );
  res.json({ success: true, data: rows });
}));

router.get('/risk-map', asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT name, risk_level, lat, lng
     FROM barangays
     ORDER BY
       CASE risk_level
         WHEN 'VERY_HIGH' THEN 1
         WHEN 'HIGH'      THEN 2
         WHEN 'MODERATE'  THEN 3
         WHEN 'LOW'       THEN 4
       END`
  );
  res.json({ success: true, data: rows });
}));

export default router;