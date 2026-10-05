import { Socket, Server } from 'socket.io';
import { logger } from './logger';
import db from './prisma';

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  try {
    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { participant1Id: true, participant2Id: true },
    });
    return !!conv && (conv.participant1Id === userId || conv.participant2Id === userId);
  } catch {
    return false;
  }
}

export function setupSocketHandlers(_io: Server, socket: Socket) {
  // The authenticated user id comes from the verified JWT, never from the client.
  const userId = socket.data.userId as string;

  // Personal room: users may only join their own (already joined on connect).
  socket.on('join:user', (requested: unknown) => {
    if (requested === userId) socket.join(`user:${userId}`);
  });

  // Garment rooms carry public listing updates only.
  socket.on('join:garment', (garmentId: unknown) => {
    if (isId(garmentId)) socket.join(`garment:${garmentId}`);
  });

  socket.on('leave:garment', (garmentId: unknown) => {
    if (isId(garmentId)) socket.leave(`garment:${garmentId}`);
  });

  // Conversation rooms: only the two participants may join.
  socket.on('join:conversation', async (conversationId: unknown) => {
    if (!isId(conversationId)) return;
    if (await isParticipant(conversationId, userId)) {
      socket.join(`conversation:${conversationId}`);
    } else {
      logger.warn('Socket tried to join a conversation it is not part of', { userId });
    }
  });

  socket.on('leave:conversation', (conversationId: unknown) => {
    if (isId(conversationId)) socket.leave(`conversation:${conversationId}`);
  });

  // Typing indicators: only from sockets that are in the room.
  socket.on('typing', (payload: { conversationId?: unknown }) => {
    const cid = payload?.conversationId;
    if (isId(cid) && socket.rooms.has(`conversation:${cid}`)) {
      socket.to(`conversation:${cid}`).emit('user_typing', {
        conversationId: cid,
        userId,
        displayName: socket.data.displayName,
      });
    }
  });

  socket.on('stop_typing', (payload: { conversationId?: unknown }) => {
    const cid = payload?.conversationId;
    if (isId(cid) && socket.rooms.has(`conversation:${cid}`)) {
      socket.to(`conversation:${cid}`).emit('user_stop_typing', { conversationId: cid, userId });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
}
