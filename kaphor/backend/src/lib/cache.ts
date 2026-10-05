/**
 * Tiny in-process response cache: bounded LRU with per-entry TTL.
 *
 * Why in-memory and not Redis: the API runs as a single Render instance, so an in-process cache is
 * exact (invalidation on write is immediate) and costs no network round trip. If you ever scale to
 * several instances, keep TTLs short (they are 15-120s here) or move invalidation to Redis pub/sub.
 *
 * Environment variables (all optional):
 *   CACHE_DISABLED=true      turn every cache off (useful when debugging stale data)
 *   CACHE_MAX_ENTRIES=500    maximum number of cached entries before the oldest are evicted
 *   CACHE_TTL_SCALE=1        multiply every TTL (e.g. 0.5 halves them, 2 doubles them)
 */

interface Entry {
  data: unknown;
  expiry: number;
}

const DISABLED = process.env.CACHE_DISABLED === 'true';
const MAX_ENTRIES = Math.max(50, Number(process.env.CACHE_MAX_ENTRIES) || 500);
const TTL_SCALE = Number(process.env.CACHE_TTL_SCALE) > 0 ? Number(process.env.CACHE_TTL_SCALE) : 1;

// A Map keeps insertion order, so re-inserting on read gives us LRU behaviour for free.
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  // First drop anything expired, then the least recently used.
  for (const [k, v] of store) {
    if (v.expiry < now) store.delete(k);
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function cacheGet<T>(key: string): T | undefined {
  if (DISABLED) return undefined;
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return undefined;
  }
  // Refresh recency
  store.delete(key);
  store.set(key, entry);
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs = 30_000): void {
  if (DISABLED) return;
  store.delete(key);
  store.set(key, { data, expiry: Date.now() + ttlMs * TTL_SCALE });
  evictIfNeeded();
}

/** Delete every key starting with `prefix` (or everything when no prefix is given). */
export function cacheClear(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Read-through helper. Returns the cached value, or runs `loader` once (concurrent callers for the
 * same key share the same promise, so a burst of identical requests hits the database only once).
 * Errors are never cached.
 */
export async function cacheWrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  if (DISABLED) return loader();

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = (async () => {
    try {
      const value = await loader();
      cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Cache namespaces, so write paths can invalidate precisely. */
export const CacheKeys = {
  feed: 'feed:', // garment feed pages (service-level and resolved responses)
  garments: 'garments:', // browse/search/detail responses
  stats: 'stats:', // platform impact stats
  reco: 'reco:', // per-user recommendations
  market: 'market:', // static category / market lookups
} as const;

/** Call after any garment create/update/delete/reserve/status change. */
export function invalidateGarmentCaches(): void {
  cacheClear(CacheKeys.feed);
  cacheClear(CacheKeys.garments);
  cacheClear(CacheKeys.reco);
}
