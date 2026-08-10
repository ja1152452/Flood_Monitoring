import api from './axios';

export const getSummary = () =>
  api.get('/analytics/summary').then(r => r.data.data);

export const getHourlyData = (cameraId, hours = 24) =>
  api.get('/analytics/hourly', { params: { cameraId, hours } }).then(r => r.data.data);

export const getAuditLogs = (params) =>
  api.get('/analytics/audit-logs', { params }).then(r => r.data.data);