import { PrismaClient } from '@prisma/client';

const enableQueryLogs = process.env.PRISMA_QUERY_LOGS === 'true';

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? enableQueryLogs
        ? ['query', 'error', 'warn']
        : ['error', 'warn']
      : ['error'],
});

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
export const db = prisma.$extends({
  model: {
    user: {
      async delete(args: any) {
        const user = await prisma.user.findUnique({ where: args.where, select: { email: true, username: true } });
        if (!user) throw new Error("User not found");
        
        const mark = `_deleted_${Date.now()}`;
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
    user: {
      async findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
      async findFirst({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
      async findUnique({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
    },
  },
}) as any;

export { prisma };
export default db;