import { redisGet, redisSet, redisDel, redisIncr, redisExpire } from '../lib/redis';

const LOCK_PREFIX = 'auth:lock:';
const FAILURES_PREFIX = 'auth:failures:';
const MAX_FAILURES = 5;
const LOCK_TTL_SECONDS = 15 * 60; // 15 minutes
const FAILURES_TTL_SECONDS = 15 * 60;

export async function isAccountLocked(email: string): Promise<boolean> {
  const key = `${LOCK_PREFIX}${email.toLowerCase().trim()}`;
  const exists = await redisGet(key);
  return exists !== null;
}

export async function recordFailedLogin(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const key = `${FAILURES_PREFIX}${normalized}`;
  const count = await redisIncr(key);
  if (count === 1) {
    await redisExpire(key, FAILURES_TTL_SECONDS);
  }
  if (count >= MAX_FAILURES) {
    const lockKey = `${LOCK_PREFIX}${normalized}`;
    await redisSet(lockKey, '1', LOCK_TTL_SECONDS);
    await redisDel(key);
  }
}

export async function clearFailedLogins(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  await redisDel(`${FAILURES_PREFIX}${normalized}`);
}
