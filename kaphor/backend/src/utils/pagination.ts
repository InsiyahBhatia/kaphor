export interface PaginationParams {
  after?: string;
  limit?: number;
}

export interface PaginationMeta {
  hasMore: boolean;
  nextCursor: string | null;
  total?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

export function normalizeLimit(limit?: number): number {
  if (limit == null) return DEFAULT_LIMIT;
  const n = Number(limit);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export function buildPrismaCursorArgs(params: PaginationParams): {
  take: number;
  skip: number;
  cursor?: { id: string };
} {
  const take = normalizeLimit(params.limit);
  const skip = params.after ? 1 : 0;
  const cursor = params.after ? { id: decodeCursor(params.after) } : undefined;
  return { take, skip, cursor };
}

export function buildMeta<T extends { id: string }>(
  items: T[],
  limit: number
): PaginationMeta {
  const hasMore = items.length > limit;
  const nextCursor =
    hasMore && items.length > 0 ? encodeCursor(items[items.length - 1].id) : null;
  return { hasMore, nextCursor };
}
