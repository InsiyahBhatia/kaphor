import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createPaymentIntent, createInquiryOrder, createCartOrder, getOrderPaymentDetails } from '../controllers/order.controller';
import {
  listTransactionOrders,
  getOrderDetail,
  getOrdersSummary,
  markOrderShipped,
  markOrderDelivered,
  getOrderMessages,
  postOrderMessage,
  postPeerReview,
} from '../controllers/transaction.controller';
import { setOrderShippingAddress } from '../controllers/order-address.controller';

const router = Router();

router.post('/inquiry', authenticate, createInquiryOrder);
router.post('/cart', authenticate, createCartOrder);
router.post('/', authenticate, createPaymentIntent);
router.get('/summary', authenticate, getOrdersSummary);
router.get('/transactions', authenticate, listTransactionOrders);
router.get('/:orderId', authenticate, getOrderDetail);
router.get('/:orderId/payment', authenticate, getOrderPaymentDetails);
router.patch('/:orderId/address', authenticate, setOrderShippingAddress);
router.patch('/:orderId/ship', authenticate, markOrderShipped);
router.patch('/:orderId/deliver', authenticate, markOrderDelivered);
router.get('/:orderId/messages', authenticate, getOrderMessages);
router.post('/:orderId/messages', authenticate, postOrderMessage);
router.post('/:orderId/peer-review', authenticate, postPeerReview);

export { router as orderRoutes };
