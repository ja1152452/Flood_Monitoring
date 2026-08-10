import api from './axios';

export const getUsers             = (params) => api.get('/users', { params }).then(r => r.data);
export const getUserStats         = ()        => api.get('/users/stats').then(r => r.data.data);
export const getResponderLocations= ()        => api.get('/users/responder-locations').then(r => r.data.data);
export const createUser           = (data)    => api.post('/users', data).then(r => r.data.data);
export const updateUser           = (id,data) => api.patch(`/users/${id}`, data).then(r => r.data.data);
export const deactivateUser       = (id)      => api.delete(`/users/${id}`).then(r => r.data);
export const deleteUser           = (id)      => api.delete(`/users/${id}/permanent`).then(r => r.data);