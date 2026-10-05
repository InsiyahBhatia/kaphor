import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class MemoryStore {
  private data: Map<string, { value: string; expires?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.data.get(key);
    if (!item) return null;
    if (item.expires && item.expires < Date.now()) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.data.set(key, { value, expires });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}

const memoryStore = new MemoryStore();
let client: Redis | null = null;
let isRedisAvailable = false;

function getRedisClient(): Redis | null {
  if (!client && process.env.NODE_ENV !== 'test') {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 1) {
          isRedisAvailable = false;
          return null;
        }
        return 1000;
      },
    });
    client.on('connect', () => {
      isRedisAvailable = true;
      logger.info('Redis connected');
    });
    client.on('error', (err) => {
      isRedisAvailable = false;
      logger.error('Redis error - falling back to memory store', { error: err.message });
    });
  }
  return client;
}

export async function redisGet(key: string): Promise<string | null> {
  if (!isRedisAvailable) return memoryStore.get(key);
  try {
    return await getRedisClient()!.get(key);
  } catch {
    return memoryStore.get(key);
  }
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (!isRedisAvailable) return memoryStore.set(key, value, ttlSeconds);
  try {
    const c = getRedisClient()!;
    if (ttlSeconds != null) {
      await c.setex(key, ttlSeconds, value);
    } else {
      await c.set(key, value);
    }
  } catch {
    return memoryStore.set(key, value, ttlSeconds);
  }
}

export async function redisDel(key: string): Promise<void> {
  if (!isRedisAvailable) return memoryStore.del(key);
  try {
    await getRedisClient()!.del(key);
  } catch {
    return memoryStore.del(key);
  }
}


/** Close the Redis connection (used during graceful shutdown). */
export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  } finally {
    client = null;
    isRedisAvailable = false;
  }
}
