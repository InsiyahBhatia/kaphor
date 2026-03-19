import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { upload } from '../middleware/upload.middleware';
import {
    getFeed,
    createPost,
    toggleLike,
    addComment,
    getComments,
    followUser,
    unfollowUser
} from '../controllers/social.controller';

const router = Router();

// Public/optional-auth
router.get('/feed', optionalAuth, getFeed);
router.get('/posts/:id/comments', getComments);

// Authenticated
router.use(authenticate);
router.post('/posts', upload.single('image'), createPost);
router.post('/posts/:id/like', toggleLike);
router.post('/posts/:id/comments', addComment);
router.post('/follow/:userId', followUser);
router.delete('/unfollow/:userId', unfollowUser);

export { router as socialRoutes };
