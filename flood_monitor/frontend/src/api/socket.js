import { io } from 'socket.io-client';

const URL = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_API_URL || 'http://localhost:5001');

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('accessToken');
    socket = io(URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
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
