import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendDirectMessage,
  reportUser,
} from '../controllers/message.controller';

const router = Router();

router.use(authenticate);

router.get('/conversations', listConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/conversations/:conversationId', getConversationMessages);
router.post('/conversations/:conversationId', sendDirectMessage);
router.post('/users/:userId/report', reportUser);

export { router as messageRoutes };
