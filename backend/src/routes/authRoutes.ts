import { Router } from 'express';
import {
  getCurrentUser,
  changePassword,
  login,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createLoginRateLimiter } from '../middleware/loginRateLimit.js';

export const authRouter = Router();
const loginRateLimiter = createLoginRateLimiter();

authRouter.post('/login', loginRateLimiter, login);
authRouter.get('/me', requireAuth, getCurrentUser);
authRouter.post('/change-password', requireAuth, changePassword);
