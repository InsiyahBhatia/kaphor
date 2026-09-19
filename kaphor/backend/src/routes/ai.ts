import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    processStyleQuiz,
    getStyleProfile,
    getRecommendations,
    getFitScore,
    chat,
    getChatHistory,
    getUpcycleSuggestions,
    assessCondition,
    analyzeListingImage,
    getT3PriceRecommendation,
    skipStyleQuiz
} from '../controllers/ai.controller';

const router = Router();

// Fit score is userId-scoped, can be called by any authenticated user
router.get('/fit-score/:userId/:garmentId', authenticate, getFitScore);

// All other routes require auth
router.use(authenticate);
router.get('/price-recommendation', getT3PriceRecommendation);
router.get('/style-profile', getStyleProfile);
router.post('/style-quiz', processStyleQuiz);
router.post('/style-quiz/skip', skipStyleQuiz);
router.get('/recommendations', getRecommendations);
router.post('/chat', chat);
router.get('/history', getChatHistory);
router.get('/history/:conversationId', getChatHistory);
router.post('/upcycle-suggestions', getUpcycleSuggestions);
router.post('/assess-condition', assessCondition);
router.post('/analyze-listing', analyzeListingImage);

export { router as aiRoutes };
