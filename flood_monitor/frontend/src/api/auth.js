import api from './axios';

export const login           = (data)                    => api.post('/auth/login', data).then(r => r.data.data);
export const getMe           = ()                        => api.get('/auth/me').then(r => r.data.data);
export const forgotPassword  = (email)                   => api.post('/auth/forgot-password', { email }).then(r => r.data);
export const resetPassword   = (email, otp, password)    => api.post('/auth/reset-password', { email, otp, password }).then(r => r.data);