import { Router } from 'express';
import { createSale, getSale, listSales } from '../controllers/salesController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const salesRouter = Router();

salesRouter.use(requireRole('Admin', 'Staff'));
salesRouter.post('/', createSale);
salesRouter.get('/', listSales);
salesRouter.get('/:id', getSale);
