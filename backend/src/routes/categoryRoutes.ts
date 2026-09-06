import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoryController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const categoryRouter = Router();

categoryRouter.get('/', requireRole('Admin', 'Staff'), listCategories);
categoryRouter.get('/:id', requireRole('Admin', 'Staff'), getCategory);
categoryRouter.post('/', requireRole('Admin'), createCategory);
categoryRouter.put('/:id', requireRole('Admin'), updateCategory);
categoryRouter.delete('/:id', requireRole('Admin'), deleteCategory);