import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { addToCart, getCart, removeFromCart } from '../controllers/cart.controller';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/', addToCart);
router.delete('/:garmentId', removeFromCart);

export { router as cartRouter };
