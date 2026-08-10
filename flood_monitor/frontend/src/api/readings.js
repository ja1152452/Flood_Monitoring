import api from './axios';

export const getLatestReading = (cameraId) =>
  api.get(`/readings/${cameraId}/latest`).then(r => r.data.data);

export const getReadingHistory = (cameraId, params) =>
  api.get(`/readings/${cameraId}/history`, { params }).then(r => r.data);

export const getTrend = (cameraId) =>
  api.get(`/readings/${cameraId}/trend`).then(r => r.data.data);

export const getRateOfRise = (cameraId) =>
  api.get(`/readings/${cameraId}/rate-of-rise`).then(r => r.data.data);

export const getAllReadings = (cameraId, params) =>
  api.get(`/readings/${cameraId}/history`, { params }).then(r => r.data.data ?? r.data);