import { Router } from 'express';
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from '../controllers/supplierController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const supplierRouter = Router();

supplierRouter.get('/', requireRole('Admin'), listSuppliers);
supplierRouter.get('/:id', requireRole('Admin'), getSupplier);
supplierRouter.post('/', requireRole('Admin'), createSupplier);
supplierRouter.put('/:id', requireRole('Admin'), updateSupplier);
supplierRouter.delete('/:id', requireRole('Admin'), deleteSupplier);