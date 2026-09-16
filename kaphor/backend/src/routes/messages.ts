import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listConversations,
  getOrCreateConversation,
  getOrCreateOrderConversation,
  getConversationMessages,
  sendDirectMessage,
  reportUser,
  getUnreadMessagesCount,
  linkConversationGarment,
} from '../controllers/message.controller';

const router = Router();

router.use(authenticate);

router.get('/unread-count', getUnreadMessagesCount);
router.get('/conversations', listConversations);
router.post('/conversations', getOrCreateConversation);
router.post('/orders/:orderId/conversation', getOrCreateOrderConversation);
router.get('/conversations/:conversationId', getConversationMessages);
router.patch('/conversations/:conversationId/garment', linkConversationGarment);
router.post('/conversations/:conversationId', sendDirectMessage);
router.post('/users/:userId/report', reportUser);

export { router as messageRoutes };
