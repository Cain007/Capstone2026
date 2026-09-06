import { Router } from 'express';
import { getAdminDashboard } from '../controllers/dashboardController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const dashboardRouter = Router();

dashboardRouter.get('/admin', requireRole('Admin'), getAdminDashboard);
