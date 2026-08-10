import api from './axios';
export const getContacts = () => api.get('/contacts').then(r => r.data.data);