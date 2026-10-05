import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { redisSet, redisGet, redisDel } from './redis';
import { logger } from './logger';
import db from './prisma';
import { verifyAccessToken } from '../utils/jwt';

import { setupSocketHandlers } from './socketHandler';

const USER_SOCKET_PREFIX = 'socket:user:';

let io: Server | null = null;

export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
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
      const user = await db.user.findUnique({
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

async function getSocketId(userId: string): Promise<string | null> {
  try {
    return await redisGet(`${USER_SOCKET_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export async function emitToUser(userId: string, event: string, data: unknown): Promise<void> {
  if (!io) return;
  // Emit to user room (reliable regardless of Redis state)
  io.to(`user:${userId}`).emit(event, data);

  // Also emit to direct socket ID if cached
  const socketId = await getSocketId(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
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
