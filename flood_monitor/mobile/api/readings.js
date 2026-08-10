import api from './axios';
const CAMERA_ID = '3b7e2b66-d4d5-4ae9-be3f-1c7c31e5b03f';
export const getLatestReading = () => api.get(`/readings/${CAMERA_ID}/latest`).then(r => r.data.data);
export const getTrend         = () => api.get(`/readings/${CAMERA_ID}/trend`).then(r => r.data.data);
export const getRateOfRise    = () => api.get(`/readings/${CAMERA_ID}/rate-of-rise`).then(r => r.data.data);