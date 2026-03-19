import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    processStyleQuiz,
    getRecommendations,
    getFitScore,
    chat,
    getUpcycleSuggestions
} from '../controllers/ai.controller';

const router = Router();

// Fit score is userId-scoped, can be called by any authenticated user
router.get('/fit-score/:userId/:garmentId', authenticate, getFitScore);

// All other routes require auth
router.use(authenticate);
router.post('/style-quiz', processStyleQuiz);
router.get('/recommendations', getRecommendations);
router.post('/chat', chat);
router.post('/upcycle-suggestions', getUpcycleSuggestions);

export { router as aiRoutes };
