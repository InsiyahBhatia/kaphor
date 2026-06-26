import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

/**
 * Android devices cannot reach the dev machine via "localhost" (that is the phone itself).
 * When the URL points at localhost/127.0.0.1, swap in the Metro host IP (physical device) or 10.0.2.2 (emulator).
 */
function resolveApiBaseUrl(): string {
  const fallback = 'http://localhost:4000/api/v1';
  const raw = process.env.EXPO_PUBLIC_API_URL ?? fallback;

  if (!__DEV__ || Platform.OS !== 'android') {
    return raw;
  }

  try {
    const u = new URL(raw);
    const useAdbReverse = process.env.EXPO_PUBLIC_USE_ADB_REVERSE === 'true';

    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return raw;
    }

    // If explicitly using ADB reverse, don't swap the hostname
    if (useAdbReverse) {
      return raw;
    }

    const hostUri =
      Constants.expoConfig?.hostUri ?? (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
    let hostname = '10.0.2.2';
    if (hostUri) {
      const metroHost = hostUri.split(':')[0];
      if (metroHost && metroHost !== '127.0.0.1' && metroHost !== 'localhost') {
        hostname = metroHost;
      }
    }
    u.hostname = hostname;
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

const API_URL = resolveApiBaseUrl();
if (__DEV__) {
  console.log('API_URL:', API_URL);
}
const TOKEN_KEY = 'kaphor_access_token';
const REFRESH_KEY = 'kaphor_refresh_token';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken ?? (await SecureStore.getItemAsync(TOKEN_KEY));
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (token) original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }
    original._retry = true;
    isRefreshing = true;
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) {
      useAuthStore.getState().logout();
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      isRefreshing = false;
      return Promise.reject(err);
    }
    try {
      const { data } = await axios.post<{
        data: { accessToken: string; refreshToken?: string };
      }>(`${API_URL}/auth/refresh`, { refreshToken }, { headers: { 'Content-Type': 'application/json' } });
      const accessToken = data.data?.accessToken;
      const newRefresh = data.data?.refreshToken;
      if (accessToken) {
        await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
        if (newRefresh) {
          await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
        }
        useAuthStore.getState().setTokens(accessToken);
        processQueue(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      }
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      useAuthStore.getState().logout();
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } finally {
      isRefreshing = false;
    }
    return Promise.reject(err);
  }
);

export async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }
}

export async function clearStoredTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export default api;
