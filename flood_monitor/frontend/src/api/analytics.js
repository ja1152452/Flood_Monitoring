import api from './axios';

export const getSummary = () =>
  api.get('/analytics/summary').then(r => r.data.data);

export const getHourlyData = (cameraId, hours = 24) =>
  api.get('/analytics/hourly', { params: { cameraId, hours } }).then(r => r.data.data);

export const getAuditLogs = (params) =>
  api.get('/analytics/audit-logs', { params }).then(r => r.data.data);

export const createAuditLog = (data) =>
  api.post('/analytics/audit-logs', data).then(r => r.data.data);

export const updateAuditLog = (id, data) =>
  api.put(`/analytics/audit-logs/${id}`, data).then(r => r.data.data);

export const deleteAuditLog = (id) =>
  api.delete(`/analytics/audit-logs/${id}`).then(r => r.data);