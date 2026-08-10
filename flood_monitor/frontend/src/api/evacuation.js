import api from './axios';

export const getEvacuationCenters = () =>
  api.get('/evacuation').then(r => r.data.data);

export const updateEvacuationCenter = (id, data) =>
  api.patch(`/evacuation/${id}`, data).then(r => r.data.data);

export const deleteEvacuationCenter = (id) =>
  api.delete(`/evacuation/${id}`).then(r => r.data);

export const getNearestCenters = (lat, lng) =>
  api.get('/evacuation/nearest', { params: { lat, lng } }).then(r => r.data.data);