import { Router } from 'express';
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from '../controllers/supplierController.js';

export const supplierRouter = Router();

supplierRouter.get('/', listSuppliers);
supplierRouter.get('/:id', getSupplier);
supplierRouter.post('/', createSupplier);
supplierRouter.put('/:id', updateSupplier);
supplierRouter.delete('/:id', deleteSupplier);