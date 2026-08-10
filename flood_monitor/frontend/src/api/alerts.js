import api from './axios';

export const getActiveAlerts = () =>
  api.get('/alerts/active').then(r => r.data.data);

export const getAlertHistory = (params) =>
  api.get('/alerts/history', { params }).then(r => r.data);

export const resolveAlert = (id, notes) =>
  api.patch(`/alerts/${id}/resolve`, { notes }).then(r => r.data.data);

export const toggleSiren = (id, siren_active) =>
  api.patch(`/alerts/${id}/siren`, { siren_active }).then(r => r.data.data);

export const triggerManualAlarm = () =>
  api.post('/alerts/manual').then(r => r.data.data);