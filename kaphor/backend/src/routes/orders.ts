import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createPaymentIntent, createInquiryOrder } from '../controllers/order.controller';
import {
  listTransactionOrders,
  getOrderDetail,
  markOrderShipped,
  markOrderDelivered,
  getOrderMessages,
  postOrderMessage,
  postPeerReview,
} from '../controllers/transaction.controller';

const router = Router();

router.post('/inquiry', authenticate, createInquiryOrder);
router.post('/', authenticate, createPaymentIntent);
router.get('/transactions', authenticate, listTransactionOrders);
router.get('/:orderId', authenticate, getOrderDetail);
router.patch('/:orderId/ship', authenticate, markOrderShipped);
router.patch('/:orderId/deliver', authenticate, markOrderDelivered);
router.get('/:orderId/messages', authenticate, getOrderMessages);
router.post('/:orderId/messages', authenticate, postOrderMessage);
router.post('/:orderId/peer-review', authenticate, postPeerReview);

export { router as orderRoutes };
