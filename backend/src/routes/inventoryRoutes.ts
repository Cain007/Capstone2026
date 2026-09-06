import { Router } from 'express';
import { adjustInventory, getInventory, listInventory, listInventoryMovements } from '../controllers/inventoryController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const inventoryRouter = Router();

inventoryRouter.get('/', requireRole('Admin', 'Staff'), listInventory);
inventoryRouter.get('/movements', requireRole('Admin'), listInventoryMovements);
inventoryRouter.get('/:productId', requireRole('Admin', 'Staff'), getInventory);
inventoryRouter.post('/:productId/adjust', requireRole('Admin'), adjustInventory);
