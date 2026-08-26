import * as service from './sos.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const data = await service.createSOS(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

export const getPending = asyncHandler(async (req, res) => {
  const data = await service.getPending(req.user);
  res.json({ success: true, data });
});

export const dispatch = asyncHandler(async (req, res) => {
  const { responder_ids, notes, dispatch_type } = req.body;
  const data = await service.dispatchSOS(req.user, req.params.id, responder_ids, notes, dispatch_type);
  res.json({ success: true, data });
});

export const respond = asyncHandler(async (req, res) => {
  const { status_type } = req.body || {};
  const data = await service.respondToSOS(req.user, req.params.id, status_type);
  res.json({ success: true, data });
});

export const decline = asyncHandler(async (req, res) => {
  const { reason } = req.body || {};
  const data = await service.declineSOS(req.user, req.params.id, reason);
  res.json({ success: true, data });
});

export const resolve = asyncHandler(async (req, res) => {
  const data = await service.completeRescue(req.user, req.params.id);
  res.json({ success: true, data });
});

export const resolveBackup = asyncHandler(async (req, res) => {
  const data = await service.resolveBackup(req.params.id, req.user.id);
  res.json({ success: true, data });
});

export const getMine = asyncHandler(async (req, res) => {
  const { rows } = await import('../../config/db.js').then(m =>
    m.query(
      `SELECT * FROM sos_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    )
  );
  res.json({ success: true, data: rows });
});