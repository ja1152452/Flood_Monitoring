import api from './axios';

export const getBarangays = () =>
  api.get('/barangays').then(r => r.data.data);

export const getRiskMap = () =>
  api.get('/barangays/risk-map').then(r => r.data.data);