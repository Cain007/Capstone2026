import { Router } from 'express';
import { listLoginHistory } from '../controllers/auditController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const securityRouter = Router();

securityRouter.use(requireRole('Admin'));
securityRouter.get('/login-history', listLoginHistory);
