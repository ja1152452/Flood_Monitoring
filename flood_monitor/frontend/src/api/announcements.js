import api from './axios';

export const getAnnouncements = () =>
  api.get('/announcements').then(r => r.data.data);

export const createAnnouncement = (data) =>
  api.post('/announcements', data).then(r => r.data.data);

export const deactivateAnnouncement = (id) =>
  api.patch(`/announcements/${id}/deactivate`).then(r => r.data.data);