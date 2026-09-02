import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoryController.js';

export const categoryRouter = Router();

categoryRouter.get('/', listCategories);
categoryRouter.get('/:id', getCategory);
categoryRouter.post('/', createCategory);
categoryRouter.put('/:id', updateCategory);
categoryRouter.delete('/:id', deleteCategory);