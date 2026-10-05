/**
 * Very short-lived cache of "this user id is an active user" lookups done by the auth middleware.
 *
 * Every authenticated request used to run one SELECT on users. A mobile screen often fires 3-6 requests at once,
 * so this saves a lot of round trips to the (remote, pooled) database. The window is deliberately tiny, and any
 * write to the users table through our Prisma client clears it (see lib/prisma.ts), so deactivating an account or
 * changing a role still takes effect immediately on this instance.
 */
export interface CachedAuthUser {
  id: string;
  email: string;
  role: string;
  displayName?: string;
}

const TTL_MS = Math.max(0, Number(process.env.AUTH_CACHE_TTL_MS ?? 10_000));
const MAX = 2000;
const store = new Map<string, { user: CachedAuthUser; expiry: number }>();

export function getCachedAuthUser(id: string): CachedAuthUser | undefined {
  if (TTL_MS === 0) return undefined;
  const hit = store.get(id);
  if (!hit) return undefined;
  if (hit.expiry < Date.now()) {
    store.delete(id);
    return undefined;
  }
  return hit.user;
}

export function setCachedAuthUser(user: CachedAuthUser): void {
  if (TTL_MS === 0) return;
  if (store.size >= MAX) {
    const oldest = store.keys().next().value as string | undefined;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(user.id, { user, expiry: Date.now() + TTL_MS });
}

/** Forget one user (or everyone when no id is given). */
export function invalidateAuthUser(id?: string): void {
  if (id) store.delete(id);
  else store.clear();
}
