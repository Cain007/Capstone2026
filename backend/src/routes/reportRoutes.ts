import { Router } from 'express';
import { getReportSummary } from '../controllers/reportController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const reportRouter = Router();

reportRouter.use(requireRole('Admin'));
reportRouter.get('/summary', getReportSummary);
