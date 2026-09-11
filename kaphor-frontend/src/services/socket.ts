import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

function resolveSocketUrl(): string {
  const fallback = 'https://kaphor-backend.onrender.com';
  const raw = process.env.EXPO_PUBLIC_SOCKET_URL ?? fallback;

  if (!__DEV__ || Platform.OS !== 'android') {
    return raw;
  }

  try {
    const u = new URL(raw);
    const hostUri =
      Constants.expoConfig?.hostUri ?? (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
    if (hostUri) {
      const metroHost = hostUri.split(':')[0];
      if (metroHost && metroHost !== '127.0.0.1' && metroHost !== 'localhost') {
        u.hostname = metroHost;
      }
    }
    return u.origin;
  } catch {
    return raw;
  }
}

const SOCKET_URL = resolveSocketUrl();

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  const user = useAuthStore.getState().user;
  if (!user?.id) return null;

  if (socket?.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      auth: {
        userId: user.id,
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      const currentUserId = useAuthStore.getState().user?.id;
      if (currentUserId) {
        socket?.emit('join:user', currentUserId);
      }
    });
  } else if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

