import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas';
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

authRouter.post('/register', validate({ body: registerSchema }), register);

authRouter.post('/login', validate({ body: loginSchema }), login);

authRouter.post('/google', googleLogin);

authRouter.post('/logout', logout);
authRouter.post('/refresh', refreshToken);

authRouter.post('/forgot-password', validate({ body: forgotPasswordSchema }), forgotPassword);

authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), resetPassword);

authRouter.get('/verify-email/:token', verifyEmail);
authRouter.get('/me', authenticate, getMe);
