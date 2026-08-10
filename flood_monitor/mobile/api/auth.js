import api from './axios';
import { API_URL } from './axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const login          = (data) => api.post('/auth/login', data).then(r => r.data.data);
export const getMe          = ()     => api.get('/auth/me').then(r => r.data.data);
export const verifyEmail    = (otp)  => api.post('/auth/verify-email', { otp }).then(r => r.data);
export const resendOtp      = ()     => api.post('/auth/resend-otp').then(r => r.data);
export const forgotPassword = (email)                          => api.post('/auth/forgot-password', { email }).then(r => r.data);
export const resetPassword  = (email, otp, password)           => api.post('/auth/reset-password', { email, otp, password }).then(r => r.data);
export const changePassword = (current_password, new_password) => api.patch('/auth/change-password', { current_password, new_password }).then(r => r.data);
export const updateProfile  = (data)                           => api.patch('/auth/profile', data).then(r => r.data.data);
export const uploadAvatar   = async (formData) => {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${API_URL}/api/v1/auth/avatar`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    formData,
  });
  const json = await res.json();
  if (!res.ok) { const err = new Error(json.message || 'Upload failed'); err.response = { data: json }; throw err; }
  return json.data;
};