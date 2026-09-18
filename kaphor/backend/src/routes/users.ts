import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload } from '../middleware/upload.middleware';
import {
  getMe,
  updateMe,
  updateAvatar,
  getMyListings,
  getMyWardrobe,
  addWardrobeItems,
  getMyPurchases,
  getPublicUserSummary,
  getUserReviews,
  submitIdentityVerification,
  getVerificationStatus,
  savePushToken,
  sendTestPushNotification,
} from '../controllers/user.controller';
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller';
import {
  listPayoutAccounts,
  createPayoutAccount,
  removePayoutAccount,
} from '../controllers/payment-ops.controller';
import {
  createAddressSchema,
  updateAddressSchema,
  addressIdParam,
} from '../schemas';

const router = Router();

// Public
router.get('/profile/:userId/public', getPublicUserSummary);
router.get('/profile/:userId/reviews', getUserReviews);

// Authenticated — User profile & verification
router.use(authenticate);
router.get('/me', getMe);
router.put('/me', updateMe);
router.put('/me/avatar', upload.single('avatar'), updateAvatar);
router.get('/me/listings', getMyListings);
router.get('/me/wardrobe', getMyWardrobe);
router.post('/me/wardrobe/items', addWardrobeItems);
router.get('/me/purchases', getMyPurchases);
router.post('/me/verify-identity', submitIdentityVerification);
router.get('/me/verification-status', getVerificationStatus);
router.post('/me/push-token', savePushToken);
router.post('/me/test-push', sendTestPushNotification);

// Authenticated — Address management
router.get('/me/addresses', listAddresses);
router.post('/me/addresses', validate({ body: createAddressSchema }), createAddress);
router.put('/me/addresses/:id', validate({ params: addressIdParam, body: updateAddressSchema }), updateAddress);
router.delete('/me/addresses/:id', validate({ params: addressIdParam }), deleteAddress);
router.post('/me/addresses/:id/default', validate({ params: addressIdParam }), setDefaultAddress);

// Authenticated — Seller Payout accounts
router.get('/me/payout-accounts', listPayoutAccounts);
router.post('/me/payout-accounts', createPayoutAccount);
router.delete('/me/payout-accounts/:id', removePayoutAccount);

export { router as userRoutes };
