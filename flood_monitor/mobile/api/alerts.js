import api from './axios';
export const getActiveAlerts = () => api.get('/alerts/active').then(r => r.data.data);