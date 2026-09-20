import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Lazily creates a single shared Socket.IO connection for the app's lifetime. */
export function getSocket(): Socket {
  if (!socket) {
    // Same-origin in production (single container); Vite proxies /socket.io in dev.
    socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}
