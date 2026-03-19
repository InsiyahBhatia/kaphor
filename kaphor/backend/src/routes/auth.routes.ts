import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { 
  validateRequeset, 
  commonValidations 
} from '../middleware/validation.middleware';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getMe,
  googleLogin,
} from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post(
  '/register',
  [
    commonValidations.email(),
    commonValidations.password(),
    commonValidations.username(),
    commonValidations.displayName(),
  ],
  validateRequeset,
  register
);

authRouter.post(
  '/login',
  [
    commonValidations.email(),
  ],
  validateRequeset,
  login
);

authRouter.post('/google', googleLogin);

authRouter.post('/logout', authenticate, logout);
authRouter.post('/refresh', refreshToken);

authRouter.post(
  '/forgot-password',
  [commonValidations.email()],
  validateRequeset,
  forgotPassword
);

authRouter.post(
  '/reset-password',
  [
    commonValidations.password(),
  ],
  validateRequeset,
  resetPassword
);

authRouter.get('/verify-email/:token', verifyEmail);
authRouter.get('/me', authenticate, getMe);
