import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny stale-while-revalidate store: synchronous memory read (peek) so screens can render
 * instantly, with an AsyncStorage copy that survives app restarts (hydrate on first use).
 */
const mem = new Map<string, any>();
const PREFIX = '@kaphor_cache_swr_';
let writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function peek<T = any>(key: string): T | undefined {
  return mem.get(key);
}

export function remember<T = any>(key: string, value: T): void {
  mem.set(key, value);
  const prev = writeTimers.get(key);
  if (prev) clearTimeout(prev);
  // Debounced persist so rapid updates do not hammer storage
  writeTimers.set(
    key,
    setTimeout(() => {
      writeTimers.delete(key);
      try {
        AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)).catch(() => {});
      } catch {}
    }, 400)
  );
}

export async function hydrate<T = any>(key: string): Promise<T | undefined> {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!mem.has(key)) mem.set(key, parsed);
      return mem.get(key);
    }
  } catch {}
  return undefined;
}

export function forget(prefix = ''): void {
  for (const k of Array.from(mem.keys())) if (k.startsWith(prefix)) mem.delete(k);
}
