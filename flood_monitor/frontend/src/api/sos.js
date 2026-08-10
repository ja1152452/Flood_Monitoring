import api from './axios';

export const getPendingSOS = () =>
  api.get('/sos/pending').then(r => (Array.isArray(r.data?.data) ? r.data.data : []));

export const getSOSHistory = () =>
  api.get('/sos/history').then(r => (Array.isArray(r.data?.data) ? r.data.data : []));

export const dispatchSOS = (id, responderIds, notes, dispatchType = 'PRIMARY') =>
  api.patch(`/sos/${id}/dispatch`, { responder_ids: responderIds, notes, dispatch_type: dispatchType }).then(r => r.data.data);

export const respondSOS = (id, statusType) =>
  api.patch(`/sos/${id}/respond`, { status_type: statusType }).then(r => r.data.data);

export const declineSOS = (id, reason) =>
  api.patch(`/sos/${id}/decline`, { reason }).then(r => r.data.data);

export const completeSOS = (id) =>
  api.patch(`/sos/${id}/complete`).then(r => r.data.data);

export const getActiveBackups = () =>
  api.get('/sos/backup').then(r => (Array.isArray(r.data?.data) ? r.data.data : []));

export const resolveBackup = (id) =>
  api.patch(`/sos/backup/${id}/resolve`).then(r => r.data.data);

export const dispatchBackup = (id, responderId, notes) =>
  api.post(`/sos/backup/${id}/dispatch`, { responder_id: responderId, notes }).then(r => r.data.data);