import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../controllers/productController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const productRouter = Router();

productRouter.get('/', requireRole('Admin', 'Staff'), listProducts);
productRouter.get('/:id', requireRole('Admin', 'Staff'), getProduct);
productRouter.post('/', requireRole('Admin'), createProduct);
productRouter.put('/:id', requireRole('Admin'), updateProduct);
productRouter.delete('/:id', requireRole('Admin'), deleteProduct);
