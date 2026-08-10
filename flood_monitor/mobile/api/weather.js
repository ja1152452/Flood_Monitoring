import api from './axios';
export const getWeather = () => api.get('/weather').then(r => r.data.data);