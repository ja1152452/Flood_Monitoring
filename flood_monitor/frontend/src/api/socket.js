import { io } from 'socket.io-client';

const URL = (import.meta.env.VITE_API_URL || 'https://flood-monitoring.up.railway.app').replace(/\/$/, '');

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('accessToken');
    socket = io(URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      withCredentials: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
