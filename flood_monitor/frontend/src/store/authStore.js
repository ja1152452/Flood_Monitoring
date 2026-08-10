import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('accessToken') || null,

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('accessToken',  token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user',         JSON.stringify(user));
    set({ user, token });
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, token: null });
  },
}));