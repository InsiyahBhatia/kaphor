import { Socket, Server } from 'socket.io';
import { logger } from './logger';

export function setupSocketHandlers(io: Server, socket: Socket) {
  // Join personal room for private notifications
  socket.on('join:user', (userId: string) => {
    if (userId) {
      socket.join(`user:${userId}`);
      logger.info(`Socket ${socket.id} joined personal room: user:${userId}`);
    }
  });

  // Join garment room for live updates on specific items
  socket.on('join:garment', (garmentId: string) => {
    if (garmentId) {
      socket.join(`garment:${garmentId}`);
      logger.info(`Socket ${socket.id} joined garment room: garment:${garmentId}`);
    }
  });

  // Leave garment room
  socket.on('leave:garment', (garmentId: string) => {
    if (garmentId) {
      socket.leave(`garment:${garmentId}`);
      logger.info(`Socket ${socket.id} left garment room: garment:${garmentId}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
}
