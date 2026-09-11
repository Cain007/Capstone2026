import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../controllers/productController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { uploadImage, removeImage } from '../controllers/productImageController.js';
import { productImageRateLimit, productImageUpload } from '../middleware/productImageUpload.js';

export const productRouter = Router();

productRouter.get('/', requireRole('Admin', 'Staff'), listProducts);
productRouter.get('/:id', requireRole('Admin', 'Staff'), getProduct);
productRouter.post('/:id/image', requireRole('Admin'), productImageRateLimit, productImageUpload, uploadImage);
productRouter.delete('/:id/image', requireRole('Admin'), productImageRateLimit, removeImage);
productRouter.post('/', requireRole('Admin'), createProduct);
productRouter.put('/:id', requireRole('Admin'), updateProduct);
productRouter.delete('/:id', requireRole('Admin'), deleteProduct);
