import { Router } from 'express';
import { query } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, number, category
     FROM emergency_contacts
     WHERE is_active = TRUE
     ORDER BY sort_order ASC`
  );
  res.json({ success: true, data: rows });
}));

export default router;