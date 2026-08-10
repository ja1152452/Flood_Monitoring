import api from './axios';
export const getAnnouncements = () =>
  api.get('/announcements').then(r => r.data.data);