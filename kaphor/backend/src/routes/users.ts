import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload.middleware';
import { getMe, updateMe, updateAvatar, getMyListings, getMyPurchases } from '../controllers/user.controller';

const router = Router();

router.use(authenticate);
router.get('/me', getMe);
router.put('/me', updateMe);
router.put('/me/avatar', upload.single('avatar'), updateAvatar);
router.get('/me/listings', getMyListings);
router.get('/me/purchases', getMyPurchases);

export { router as userRoutes };
