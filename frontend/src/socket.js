import { io } from 'socket.io-client';

let socket = null;

export function conectarSocket() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  if (socket && socket.connected) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function desconectarSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
