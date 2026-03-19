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

export function getIO(): Server | null {
  return io;
}

export async function getSocketId(userId: string): Promise<string | null> {
  return redisGet(`${USER_SOCKET_PREFIX}${userId}`);
}

export async function emitToUser(userId: string, event: string, data: unknown): Promise<void> {
  const socketId = await getSocketId(userId);
  if (socketId && io) {
    io.to(socketId).emit(event, data);
  }
}

export function emitToRoom(room: string, event: string, data: unknown): void {
  if (io) {
    io.to(room).emit(event, data);
  }
}
