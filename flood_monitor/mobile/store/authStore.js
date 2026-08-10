import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { queryClient } from '../utils/queryClient';

export const useAuthStore = create((set, get) => ({
  user:       null,
  token:      null,
  sirenMuted: false,

  loadFromStorage: async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const rawUser = await AsyncStorage.getItem('user');
      let user = null;
      if (rawUser && rawUser !== 'undefined') {
        try { user = JSON.parse(rawUser); } catch (_) {}
      }
      const muted = (await AsyncStorage.getItem('sirenMuted')) === 'true';
      set({ token, user, sirenMuted: muted });

      if (token) {
        try {
          const res       = await api.get('/auth/me');
          const freshUser = res.data.data;
          await AsyncStorage.setItem('user', JSON.stringify(freshUser));
          set({ user: freshUser });
        } catch (err) {
          if (err?.response?.status === 401) {
            await get().logout();
            return null;
          }
        }
      }
      return token;
    } catch (e) {
      console.log('Error loading from storage:', e);
      return null;
    }
  },

  setAuth: async (user, token, refreshToken) => {
    await AsyncStorage.setItem('accessToken',  token);
    await AsyncStorage.setItem('refreshToken', refreshToken);
    await AsyncStorage.setItem('user',         JSON.stringify(user));
    set({ user, token });
  },

  toggleSirenMute: async () => {
    const muted = !get().sirenMuted;
    await AsyncStorage.setItem('sirenMuted', String(muted));
    set({ sirenMuted: muted });
  },

  logout: async () => {
    const currentToken = get().token;
    if (currentToken) {
      try {
        await api.patch('/auth/fcm-token', { fcm_token: null }).catch(() => {});
      } catch (_) {}
    }
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    } catch (_) {}
    try {
      queryClient.clear();
    } catch (_) {}
    set({ user: null, token: null, sirenMuted: false });
  },
}));

