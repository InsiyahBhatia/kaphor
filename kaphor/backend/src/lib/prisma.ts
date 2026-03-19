import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Enhanced Database Client with Security Overrides
 */
// @ts-ignore - Prisma $extends typing can be tricky in some environments
export const db = prisma.$extends({
  model: {
    user: {
      async delete(where: any) {
        return prisma.user.update({
          where,
          data: { isActive: false },
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