import api from './axios';
export const getEvacuationCenters    = ()           => api.get('/evacuation').then(r => r.data.data);
export const getRecommendedCenters   = (lat, lng)   => api.get('/evacuation/recommend', { params: { lat, lng } }).then(r => r.data.data);
export const getEvacuationByBarangay = (barangay)   => api.get('/evacuation/by-barangay', { params: { barangay } }).then(r => r.data.data);
export const getMyEvacuationCenters  = ()           => api.get('/evacuation/mine').then(r => r.data.data);
export const updateEvacuationCenter  = (id, data)   => api.patch(`/evacuation/${id}`, data).then(r => r.data.data);
