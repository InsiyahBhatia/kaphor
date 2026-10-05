import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Key-value storage that keeps secrets safe.
 *
 * - Sign-in data (tokens and the saved session) is "sensitive". On phones it is stored
 *   in the device keychain / keystore (SecureStore) and never in plain AsyncStorage.
 * - Everything else (caches, preferences) goes in AsyncStorage.
 * - On the web there is no secure option, so localStorage is used for everything.
 *
 * SecureStore works best with small values, so large values are split into chunks.
 */

const SENSITIVE_KEYS = new Set(['kaphor_access_token', 'kaphor_refresh_token', 'auth_data']);
const CHUNK_SIZE = 1800;

const isSensitive = (key: string) => SENSITIVE_KEYS.has(key);
const isWeb = Platform.OS === 'web';

function webStore(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ── Secure (native) helpers ─────────────────────────────────────────────

async function secureSet(key: string, value: string): Promise<void> {
  await secureDelete(key);
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
  if (chunks.length === 0) chunks.push('');
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
  }
  await SecureStore.setItemAsync(`${key}.n`, String(chunks.length));
}

async function secureGet(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  if (!countRaw) return null;
  const count = parseInt(countRaw, 10);
  if (!Number.isFinite(count) || count < 1 || count > 200) return null;
  let out = '';
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part === null) return null;
    out += part;
  }
  return out;
}

async function secureDelete(key: string): Promise<void> {
  try {
    const countRaw = await SecureStore.getItemAsync(`${key}.n`);
    const count = countRaw ? Math.min(parseInt(countRaw, 10) || 0, 200) : 0;
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
    await SecureStore.deleteItemAsync(`${key}.n`);
  } catch {
    // nothing stored under this key
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      webStore()?.setItem(key, value);
    } catch (e) {
      console.warn('Storage write failed');
    }
    return;
  }

  if (isSensitive(key)) {
    try {
      await secureSet(key, value);
      // Remove any old plain copy left by earlier app versions
      AsyncStorage.removeItem(key).catch(() => {});
    } catch {
      console.warn('Secure storage write failed');
    }
    return;
  }

  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    console.warn('Storage write failed');
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return webStore()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  if (isSensitive(key)) {
    try {
      const secure = await secureGet(key);
      if (secure !== null) return secure;

      // One-time move from the old plain storage into the secure one
      const legacy = (await AsyncStorage.getItem(key)) ?? (await SecureStore.getItemAsync(key));
      if (legacy) {
        await secureSet(key, legacy);
        AsyncStorage.removeItem(key).catch(() => {});
        SecureStore.deleteItemAsync(key).catch(() => {});
        return legacy;
      }
    } catch {
      // fall through
    }
    return null;
  }

  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      webStore()?.removeItem(key);
    } catch {}
    return;
  }

  if (isSensitive(key)) {
    await secureDelete(key);
    SecureStore.deleteItemAsync(key).catch(() => {});
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

/** Remove cached personal data (feeds, chats, saved items) when someone signs out. */
export async function clearUserCaches(): Promise<void> {
  const prefixes = ['@kaphor_cache_', '@kaphor_chat_', '@kaphor_shop_feed_cache'];
  try {
    if (isWeb) {
      const store = webStore();
      if (!store) return;
      Object.keys(store)
        .filter((k) => prefixes.some((p) => k.startsWith(p)))
        .forEach((k) => store.removeItem(k));
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => prefixes.some((p) => k.startsWith(p)));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch {
    // best effort
  }
}

export const safeStorage = {
  setItem,
  getItem,
  deleteItem,
  clearUserCaches,
};

export default safeStorage;
