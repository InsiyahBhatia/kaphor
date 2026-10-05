import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

function resolveSocketUrl(): string {
  const fallback = 'https://kaphor-backend.onrender.com';
  const raw = process.env.EXPO_PUBLIC_SOCKET_URL ?? fallback;

  // Release builds must use a secure connection
  if (!__DEV__) {
    return raw.startsWith('https://') ? raw : fallback;
  }

  if (Platform.OS !== 'android') {
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
  const user = useAuthStore.getState().user;
  if (!user?.id) return null;

  if (socket?.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      // Read the latest token on every (re)connect so refreshed tokens are used
      auth: (cb) =>
        cb({
          userId: useAuthStore.getState().user?.id,
          token: useAuthStore.getState().accessToken,
        }),
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

/** Close the connection and forget it (call on sign out). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
