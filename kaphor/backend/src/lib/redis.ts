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

  async exists(key: string): Promise<number> {
    const val = await this.get(key);
    return val !== null ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const val = await this.get(key);
    const num = val ? parseInt(val, 10) + 1 : 1;
    await this.set(key, num.toString());
    return num;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const item = this.data.get(key);
    if (item) {
      item.expires = Date.now() + seconds * 1000;
    }
  }
}

const memoryStore = new MemoryStore();
let client: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis | null {
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

export async function redisExists(key: string): Promise<boolean> {
  if (!isRedisAvailable) return (await memoryStore.exists(key)) === 1;
  try {
    const n = await getRedisClient()!.exists(key);
    return n === 1;
  } catch {
    return (await memoryStore.exists(key)) === 1;
  }
}

export async function redisIncr(key: string): Promise<number> {
  if (!isRedisAvailable) return memoryStore.incr(key);
  try {
    return await getRedisClient()!.incr(key);
  } catch {
    return memoryStore.incr(key);
  }
}

export async function redisExpire(key: string, seconds: number): Promise<void> {
  if (!isRedisAvailable) return memoryStore.expire(key, seconds);
  try {
    await getRedisClient()!.expire(key, seconds);
  } catch {
    return memoryStore.expire(key, seconds);
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore
    }
    client = null;
    isRedisAvailable = false;
    logger.info('Redis connection closed');
  }
}

export default getRedisClient;
