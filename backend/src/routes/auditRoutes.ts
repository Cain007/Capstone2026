import { Router } from 'express';
import { listAuditEvents } from '../controllers/auditController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const auditRouter = Router();

auditRouter.use(requireRole('Admin'));
auditRouter.get('/', listAuditEvents);
