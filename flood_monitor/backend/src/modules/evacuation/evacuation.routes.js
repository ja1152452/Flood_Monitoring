import { Router } from 'express';
import * as controller from './evacuation.controller.js';
import * as service from './evacuation.service.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { query } from '../../config/db.js';
import { createSchema, updateSchema } from './evacuation.schema.js';
import Joi from 'joi';

const router = Router();
router.use(authenticate);

router.get('/recommend',
  authorize('CITIZEN','RESCUE','ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }
    const { rows } = await query(
      `SELECT ec.*,
              b.name AS barangay_name,
              ROUND((
                6371000 * acos(
                  LEAST(1.0, cos(radians($1)) * cos(radians(ec.lat)) *
                  cos(radians(ec.lng) - radians($2)) +
                  sin(radians($1)) * sin(radians(ec.lat)))
                )
              )::numeric, 0) AS distance_m,
              (ec.capacity_total - ec.capacity_current) AS available_slots
       FROM evacuation_centers ec
       LEFT JOIN barangays b ON b.id = ec.barangay_id
       WHERE ec.is_open = TRUE
         AND ec.capacity_current < ec.capacity_total
       ORDER BY distance_m ASC
       LIMIT 5`,
      [parseFloat(lat), parseFloat(lng)]
    );
    res.json({ success: true, data: rows });
  })
);

router.get('/mine',
  authorize('CITIZEN','RESCUE','ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    const barangay = req.user.barangay_name;
    if (!barangay) return res.json({ success: true, data: [] });
    const { rows } = await query(
      `SELECT ec.name, ec.address,
              ec.capacity_total, ec.capacity_current,
              (ec.capacity_total - ec.capacity_current) AS available_slots
       FROM evacuation_centers ec
       LEFT JOIN barangays b ON b.id = ec.barangay_id
       WHERE ec.is_open = TRUE
         AND ec.capacity_current < ec.capacity_total
         AND b.name ILIKE $1
       ORDER BY available_slots DESC`,
      [barangay]
    );
    res.json({ success: true, data: rows });
  })
);

router.get('/',
  authorize('CITIZEN','RESCUE','ADMIN','SUPER_ADMIN','MSWDO'),
  controller.getAll
);

router.get('/by-barangay',
  authorize('CITIZEN','RESCUE','ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    const { barangay } = req.query;
    if (!barangay) return res.json({ success: true, data: [] });
    const { rows } = await query(
      `SELECT ec.name, ec.address,
              ec.capacity_total, ec.capacity_current,
              (ec.capacity_total - ec.capacity_current) AS available_slots
       FROM evacuation_centers ec
       LEFT JOIN barangays b ON b.id = ec.barangay_id
       WHERE ec.is_open = TRUE
         AND ec.capacity_current < ec.capacity_total
         AND b.name ILIKE $1
       ORDER BY available_slots DESC`,
      [barangay]
    );
    res.json({ success: true, data: rows });
  })
);

router.get('/nearest',
  authorize('CITIZEN','RESCUE','ADMIN','SUPER_ADMIN','MSWDO'),
  validate(Joi.object({
    lat:   Joi.number().min(-90).max(90).required(),
    lng:   Joi.number().min(-180).max(180).required(),
    limit: Joi.number().integer().min(1).max(20).optional(),
    open:  Joi.string().valid('true','false').optional(),
  }), 'query'),
  controller.getNearest
);

router.post('/',
  authorize('ADMIN','SUPER_ADMIN'),
  validate(createSchema),
  controller.create
);

// MDRRMO & MSWDO: get all families across all centers
router.get('/all-families',
  authorize('ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT ef.*, ec.name AS center_name,
              COALESCE(json_agg(efm ORDER BY efm.created_at) FILTER (WHERE efm.id IS NOT NULL), '[]') AS members_list
       FROM evacuation_families ef
       JOIN evacuation_centers ec ON ec.id = ef.evacuation_center_id
       LEFT JOIN evacuation_family_members efm ON efm.family_id = ef.id
       GROUP BY ef.id, ec.name
       ORDER BY ef.arrival_date DESC, ef.created_at DESC`
    );
    res.json({ success: true, data: rows });
  })
);

// Family records — must be before /:id routes
router.get('/:id/families',
  authorize('ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    const data = await service.getFamilies(req.params.id);
    res.json({ success: true, data });
  })
);

router.post('/:id/families',
  authorize('ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    console.log('[families] body:', JSON.stringify(req.body));
    const data = await service.addFamily(req.params.id, req.body, req.user.id);
    res.status(201).json({ success: true, data });
  })
);

router.put('/:id/families/:fid',
  authorize('ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    const data = await service.updateFamily(req.params.id, req.params.fid, req.body, req.user.id);
    res.json({ success: true, data });
  })
);

router.patch('/:id/families/:fid',
  authorize('ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    const data = await service.updateFamily(req.params.id, req.params.fid, req.body, req.user.id);
    res.json({ success: true, data });
  })
);

router.delete('/:id/families/:fid',
  authorize('ADMIN','SUPER_ADMIN','MSWDO'),
  asyncHandler(async (req, res) => {
    await service.deleteFamily(req.params.id, req.params.fid);
    res.json({ success: true, message: 'Deleted' });
  })
);

// /:id routes — must be AFTER specific routes
router.patch('/:id',
  authorize('ADMIN','SUPER_ADMIN','MSWDO'),
  validate(updateSchema),
  controller.update
);

router.delete('/:id',
  authorize('ADMIN','SUPER_ADMIN'),
  controller.remove
);

export default router;