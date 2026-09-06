import { Router } from 'express';
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  orderPurchaseOrder,
  receivePurchaseOrder,
} from '../controllers/purchaseOrderController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const purchaseOrderRouter = Router();

purchaseOrderRouter.use(requireRole('Admin'));
purchaseOrderRouter.get('/', listPurchaseOrders);
purchaseOrderRouter.get('/:id', getPurchaseOrder);
purchaseOrderRouter.post('/', createPurchaseOrder);
purchaseOrderRouter.post('/:id/order', orderPurchaseOrder);
purchaseOrderRouter.post('/:id/receive', receivePurchaseOrder);
