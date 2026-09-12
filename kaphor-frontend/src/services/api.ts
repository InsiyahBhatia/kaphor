import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { safeStorage } from '../utils/storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

/**
 * Android devices cannot reach the dev machine via "localhost" (that is the phone itself).
 * When the URL points at localhost/127.0.0.1, swap in the Metro host IP (physical device) or 10.0.2.2 (emulator).
 */
function resolveApiBaseUrl(): string {
  const fallback = 'https://kaphor-backend.onrender.com/api/v1';
  const raw = process.env.EXPO_PUBLIC_API_URL ?? fallback;

  if (!__DEV__ || Platform.OS !== 'android') {
    return raw;
  }

  try {
    const u = new URL(raw);
    // Only adapt local LAN/loopback IP addresses dynamically in development
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname.startsWith('10.') || u.hostname.startsWith('192.168.');
    if (isLocal) {
      const hostUri =
        Constants.expoConfig?.hostUri ?? (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
      let hostname = '10.214.166.156';
      if (hostUri) {
        const metroHost = hostUri.split(':')[0];
        if (metroHost && metroHost !== '127.0.0.1' && metroHost !== 'localhost') {
          hostname = metroHost;
        }
      }
      u.hostname = hostname;
    }
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
  timeout: 30000,
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
});

// ── Refresh token queue (prevents concurrent refreshes) ────────
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
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
    const token = useAuthStore.getState().accessToken ?? (await safeStorage.getItem(TOKEN_KEY));
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

/**
 * Attempt to refresh the access token.
 * Returns true on success, false on failure.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  const refreshTokenVal = await safeStorage.getItem(REFRESH_KEY);
  if (!refreshTokenVal) return false;

  try {
    const { data } = await axios.post<{
      data: { accessToken: string; refreshToken: string };
    }>(`${API_URL}/auth/refresh`, { refreshToken: refreshTokenVal }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const accessToken = data.data?.accessToken;
    const newRefresh = data.data?.refreshToken;

    if (!accessToken) {
      throw new Error('No access token in refresh response');
    }

    // Update tokens in persistent storage & Zustand store
    await safeStorage.setItem(TOKEN_KEY, accessToken);
    if (newRefresh) {
      await safeStorage.setItem(REFRESH_KEY, newRefresh);
    }
    useAuthStore.getState().setTokens(accessToken);

    // CRITICAL: Synchronize auth_data so AuthContext doesn't read stale/revoked tokens on next app launch
    try {
      const rawAuthData = await safeStorage.getItem('auth_data');
      if (rawAuthData) {
        const parsed = JSON.parse(rawAuthData);
        parsed.accessToken = accessToken;
        if (newRefresh) parsed.refreshToken = newRefresh;
        await safeStorage.setItem('auth_data', JSON.stringify(parsed));
      }
    } catch {}

    return true;
  } catch (err: any) {
    const status = err?.response?.status;
    const isExplicitAuthFailure = status === 401 || status === 403;

    if (isExplicitAuthFailure) {
      // Refresh token was genuinely revoked or expired by the server — clear tokens
      console.log('Refresh token revoked or expired (401/403), clearing session');
      useAuthStore.getState().logout();
      await safeStorage.deleteItem(TOKEN_KEY);
      await safeStorage.deleteItem(REFRESH_KEY);
      await safeStorage.deleteItem('auth_data');
    } else {
      // Network timeout / Render cold start / 5xx error: DO NOT wipe tokens!
      console.warn('Token refresh temporary failure (network/timeout), preserving session:', err?.message || err);
    }
    return false;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    // ── If a refresh is already in-flight, queue this request ──────
    if (isRefreshing && refreshPromise) {
      return new Promise<string | null>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (token) original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    // ── Start a new token refresh (first 401 wins) ────────────────
    original._retry = true;
    isRefreshing = true;

    refreshPromise = attemptTokenRefresh().then((success) => {
      isRefreshing = false;
      refreshPromise = null;
      return success;
    });

    const success = await refreshPromise;

    if (success) {
      // Re-read the new access token from the store (set by attemptTokenRefresh)
      const newToken = useAuthStore.getState().accessToken ??
        (await safeStorage.getItem(TOKEN_KEY));
      processQueue(null, newToken);
      if (newToken) original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } else {
      processQueue(new Error('Token refresh failed'), null);
      return Promise.reject(err);
    }
  }
);

export async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  await safeStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    await safeStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    await safeStorage.deleteItem(REFRESH_KEY);
  }
}

export async function clearStoredTokens(): Promise<void> {
  await safeStorage.deleteItem(TOKEN_KEY);
  await safeStorage.deleteItem(REFRESH_KEY);
}

import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════════════════════════
// TTL-based GET cache with persistent Offline Storage Fallback
// ═══════════════════════════════════════════════════════════════

interface CacheEntry {
  data: any;
  expiry: number;
}

const GET_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds memory freshness
const OFFLINE_PREFIX = '@kaphor_cache_';

/**
 * Fetch a GET endpoint with built-in TTL caching and persistent offline fallback.
 * - If fresh cached data exists in memory, return it immediately.
 * - If stale cached data exists, return it and trigger a background refresh.
 * - If offline or network fails, gracefully fall back to persisted local storage.
 */
export async function cachedGet<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  const cacheKey = `${url}${params ? JSON.stringify(params) : ''}`;
  const storageKey = `${OFFLINE_PREFIX}${cacheKey}`;
  const now = Date.now();
  const cached = GET_CACHE.get(cacheKey);

  // 1. If cache hit and still fresh in memory, return immediately
  if (cached && now < cached.expiry) {
    return cached.data as T;
  }

  // 2. If stale memory cache exists, fire background refresh but return stale data
  if (cached) {
    api.get(url, { params }).then(async ({ data }) => {
      const result = data.data ?? data;
      GET_CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(result));
      } catch {}
    }).catch(() => {});
    return cached.data as T;
  }

  // 3. Try network fetch
  try {
    const { data } = await api.get(url, { params });
    const result = data.data ?? data;
    GET_CACHE.set(cacheKey, { data: result, expiry: now + CACHE_TTL_MS });
    AsyncStorage.setItem(storageKey, JSON.stringify(result)).catch(() => {});
    return result as T;
  } catch (netErr) {
    // 4. On network failure / offline, attempt to load persisted offline cache
    try {
      const persisted = await AsyncStorage.getItem(storageKey);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        GET_CACHE.set(cacheKey, { data: parsed, expiry: now + CACHE_TTL_MS });
        return parsed as T;
      }
    } catch {}
    throw netErr;
  }
}

/**
 * Bypass cache and force-refresh a GET endpoint, updating the cache.
 */
export async function fetchFresh<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  const cacheKey = `${url}${params ? JSON.stringify(params) : ''}`;
  const storageKey = `${OFFLINE_PREFIX}${cacheKey}`;
  const { data } = await api.get(url, { params });
  const result = data.data ?? data;
  GET_CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });
  AsyncStorage.setItem(storageKey, JSON.stringify(result)).catch(() => {});
  return result as T;
}

/**
 * Invalidate all cached GET responses for URLs matching a prefix.
 * Useful after a mutation (POST/PUT/PATCH/DELETE) to force a fresh fetch.
 */
export function invalidateCache(prefix: string): void {
  for (const key of GET_CACHE.keys()) {
    if (key.startsWith(prefix)) {
      GET_CACHE.delete(key);
      AsyncStorage.removeItem(`${OFFLINE_PREFIX}${key}`).catch(() => {});
    }
  }
}

export default api;
