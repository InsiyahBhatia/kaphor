import { PrismaClient } from '@prisma/client';
import { invalidateGarmentCaches, cacheClear } from './cache';
import { invalidateAuthUser } from './authCache';

const enableQueryLogs = process.env.PRISMA_QUERY_LOGS === 'true';

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? enableQueryLogs
        ? ['query', 'error', 'warn']
        : ['error', 'warn']
      : ['error', 'warn'],
});

// Writes that change what the public garment feed / detail pages show. Any of them clears the response caches,
// so no controller can forget to invalidate. A bare viewCount bump is excluded (it happens on every detail view).
const GARMENT_WRITE_OPS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
function isViewCountOnly(args: any): boolean {
  const data = args?.data;
  if (!data || typeof data !== 'object') return false;
  const keys = Object.keys(data);
  return keys.length === 1 && keys[0] === 'viewCount';
}
const invalidateOnWrite = {
  async $allOperations({ operation, args, query }: any) {
    const result = await query(args);
    if (GARMENT_WRITE_OPS.has(operation) && !isViewCountOnly(args)) invalidateGarmentCaches();
    return result;
  },
};

// Per-user list caches (order history, inbox) are cleared on any write to the tables they are built from.
function clearOnWrite(...prefixes: string[]) {
  return {
    async $allOperations({ operation, args, query }: any) {
      const result = await query(args);
      if (GARMENT_WRITE_OPS.has(operation)) prefixes.forEach((p) => cacheClear(p));
      return result;
    },
  };
}
const clearOrderCaches = clearOnWrite('orders:', 'inbox:'); // inbox rows show order status too
const clearInboxCaches = clearOnWrite('inbox:');

const RETRYABLE_DB_ERRORS = [
  /server has closed the connection/i,
  /connectionreset/i,
  /\bP1001\b/i,
  /\bP1017\b/i,
];

function isRetryableDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_DB_ERRORS.some((pattern) => pattern.test(message));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  retries = 2,
  delayMs = 120
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableDbError(error)) {
        throw error;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}

/**
 * Enhanced Database Client with Security Overrides
 */
// @ts-ignore - Prisma $extends typing can be tricky in some environments
const db = prisma.$extends({
  model: {
    user: {
      async delete(args: any) {
        const user = await prisma.user.findUnique({ where: args.where, select: { email: true, username: true } });
        if (!user) throw new Error("User not found");
        
        const mark = `_deleted_${Date.now()}`;
        invalidateAuthUser();
        return prisma.user.update({
          where: args.where,
          data: { 
            isActive: false,
            email: `${user.email}${mark}`,
            username: `${user.username}${mark}`,
            googleId: null
          },
        });
      },
    },
  },
  query: {
    garment: invalidateOnWrite,
    rental: invalidateOnWrite,
    order: clearOrderCaches,
    orderItem: clearOrderCaches,
    orderMessage: clearOrderCaches,
    peerReview: clearOrderCaches,
    conversation: clearInboxCaches,
    directMessage: clearInboxCaches,
    user: {
      // Any write to users may change role / isActive: drop cached auth lookups so changes apply immediately.
      async update({ args, query }: any) {
        const result = await query(args);
        invalidateAuthUser((args?.where as any)?.id);
        return result;
      },
      async updateMany({ args, query }: any) {
        const result = await query(args);
        invalidateAuthUser();
        return result;
      },
      async upsert({ args, query }: any) {
        const result = await query(args);
        invalidateAuthUser();
        return result;
      },
      async deleteMany({ args, query }: any) {
        const result = await query(args);
        invalidateAuthUser();
        return result;
      },
      async findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
      async findFirst({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
      async findUnique({ args }) {
        args.where = { isActive: true, ...args.where };
        return prisma.user.findFirst(args);
      },
    },
  },
}) as any;

export { prisma };
export default db;