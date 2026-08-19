import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

export const API_URL = Constants.expoConfig?.extra?.apiUrl ?? 'https://flood-monitoring.up.railway.app';
export const LOCAL_FALLBACK_URL = 'http://192.168.1.27:5001';

const request = async (method, path, data, params, extraHeaders) => {
  const token = await AsyncStorage.getItem('accessToken');
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...extraHeaders,
  };
  if (token && !extraHeaders?.Authorization) headers['Authorization'] = `Bearer ${token}`;

  const queryStr = params ? `?${new URLSearchParams(params).toString()}` : '';
  const primaryUrl = `${API_URL}/api/v1${path}${queryStr}`;
  const fallbackUrl = `${LOCAL_FALLBACK_URL}/api/v1${path}${queryStr}`;

  let res;
  try {
    res = await fetch(primaryUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (primaryErr) {
    // Primary URL network error (e.g. ngrok drop or cellular signal dip). Try local IP fallback.
    try {
      res = await fetch(fallbackUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });
    } catch (_) {
      const err = new Error('Unable to connect to server. Please check internet/Wi-Fi connection.');
      throw err;
    }
  }

  if (res.status === 401 && !path.includes('/auth/fcm-token') && !path.includes('/auth/logout')) {
    try { await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']); } catch (_) { }
    try { useAuthStore.getState().logout(); } catch (_) { }
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `Request failed (${res.status})`);
    err.response = { status: res.status, data: json };
    throw err;
  }
  return { data: json };
};

const api = {
  get: (path, config) => request('GET', path, null, config?.params, config?.headers),
  post: (path, data, config) => request('POST', path, data, config?.params, config?.headers),
  put: (path, data, config) => request('PUT', path, data, config?.params, config?.headers),
  patch: (path, data, config) => request('PATCH', path, data, config?.params, config?.headers),
  delete: (path, config) => request('DELETE', path, null, config?.params, config?.headers),
};

export default api;
