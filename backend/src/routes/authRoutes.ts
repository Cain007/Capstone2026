import { Router } from 'express';
import {
  getCurrentUser,
  changePassword,
  login,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRouter = Router();

authRouter.post('/login', login);
authRouter.get('/me', requireAuth, getCurrentUser);
authRouter.post('/change-password', requireAuth, changePassword);
