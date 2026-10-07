import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { redisSet, redisDel } from './redis';
import { logger } from './logger';
import db from './prisma';
import { verifyAccessToken } from '../utils/jwt';
import { getCachedAuthUser } from './authCache';

import { setupSocketHandlers } from './socketHandler';

const USER_SOCKET_PREFIX = 'socket:user:';

let io: Server | null = null;

export function getAllowedOrigins(): string[] {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  const defaults = ['http://localhost:8081', 'exp://localhost:8081'];
  if (process.env.FRONTEND_URL) {
    const fe = process.env.FRONTEND_URL.trim();
    if (fe && !defaults.includes(fe)) defaults.push(fe);
  }
  return defaults;
}

export function initSocket(httpServer: HttpServer): Server {
  const allowedOrigins = getAllowedOrigins();
  const isProd = process.env.NODE_ENV === 'production';

  io = new Server(httpServer, {
    path: '/socket.io',
    // Native mobile clients send no Origin header, browsers must be on the allow list.
    cors: { origin: isProd ? allowedOrigins : true, credentials: true },
    maxHttpBufferSize: 64 * 1024, // 64 KB per message
    pingTimeout: 20_000,
    connectTimeout: 10_000,
  });

  // Require a valid access token on every connection.
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('UNAUTHORIZED'));
      const decoded = verifyAccessToken(token);
      const cached = getCachedAuthUser(decoded.id);
      const user = cached
        ? { id: cached.id, displayName: cached.displayName, isActive: true }
        : await db.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, displayName: true, isActive: true },
          });
      if (!user || !user.isActive) return next(new Error('UNAUTHORIZED'));
      socket.data.userId = user.id;
      socket.data.displayName = user.displayName;
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    setupSocketHandlers(io!, socket);

    socket.join(`user:${userId}`);
    redisSet(`${USER_SOCKET_PREFIX}${userId}`, socket.id, 60 * 60 * 24).catch((err) =>
      logger.error('Redis set socket mapping failed', { error: err.message })
    );
    socket.on('disconnect', () => {
      redisDel(`${USER_SOCKET_PREFIX}${userId}`).catch(() => {});
    });
  });

  return io;
}

export async function closeSocket(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => io!.close(() => resolve()));
  io = null;
}

export async function emitToUser(userId: string, event: string, data: unknown): Promise<void> {
  if (!io) return;
  // Every connection joins `user:<id>`, so one room emit reaches all of the user's devices exactly once.
  // (No Redis lookup per event, and no duplicate delivery to the same socket.)
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToConversation(conversationId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

export function emitBroadcast(event: string, data: unknown): void {
  if (io) {
    io.emit(event, data);
  }
}
