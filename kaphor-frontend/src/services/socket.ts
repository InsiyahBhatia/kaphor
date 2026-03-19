import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket | null {
  if (socket?.connected) return socket;
  const token = useAuthStore.getState().accessToken;
  const user = useAuthStore.getState().user;
  if (!user?.id) return null;
  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: {
      userId: user.id,
      token,
    },
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
