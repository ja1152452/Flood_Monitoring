import api from './axios';
export const getLatestReading = () => api.get('/readings/latest').then(r => r.data.data);
export const getTrend         = () => api.get('/readings/trend').then(r => r.data.data);
export const getRateOfRise    = () => api.get('/readings/rate-of-rise').then(r => r.data.data);