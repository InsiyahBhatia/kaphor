import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { redisSet, redisGet, redisDel } from './redis';
import { logger } from './logger';

import { setupSocketHandlers } from './socketHandler';

const USER_SOCKET_PREFIX = 'socket:user:';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
    .split(',')
    .map((o) => o.trim());
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins },
    path: '/socket.io',
  });

  io.on('connection', (socket: Socket) => {
    if (io) setupSocketHandlers(io, socket);

    const userId = socket.handshake.auth?.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
      redisSet(`${USER_SOCKET_PREFIX}${userId}`, socket.id, 60 * 60 * 24).catch((err) =>
        logger.error('Redis set socket mapping failed', { error: err.message })
      );
      socket.on('disconnect', () => {
        redisDel(`${USER_SOCKET_PREFIX}${userId}`).catch(() => {});
      });
    }
  });

  return io;
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


