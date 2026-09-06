import { Router } from 'express';
import {
	createUser,
	getUser,
	listUsers,
	resetUserPassword,
	updateUser,
	updateUserStatus,
} from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export const userRouter = Router();

userRouter.use(requireAuth, requireRole('Admin'));
userRouter.get('/', listUsers);
userRouter.get('/:id', getUser);
userRouter.post('/', createUser);
userRouter.put('/:id', updateUser);
userRouter.patch('/:id/status', updateUserStatus);
userRouter.post('/:id/reset-password', resetUserPassword);
