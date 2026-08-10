import api from './axios';
export const getRiskAreas = () => api.get('/risk-areas').then(r => r.data.data);
