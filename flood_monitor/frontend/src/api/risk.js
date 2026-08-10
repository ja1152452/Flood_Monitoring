import api from './axios';

export const getRiskAreas  = ()         => api.get('/risk-areas').then(r => r.data.data);
export const createRiskArea = (data)    => api.post('/risk-areas', data).then(r => r.data.data);
export const updateRiskArea = (id,data) => api.patch(`/risk-areas/${id}`, data).then(r => r.data.data);
export const deleteRiskArea = (id)      => api.delete(`/risk-areas/${id}`).then(r => r.data);