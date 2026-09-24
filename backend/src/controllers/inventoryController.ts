import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  Prisma,
} from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAuditEvent } from '../utils/audit.js';
import { logError } from '../utils/safeLogger.js';
import {
  classifyStockHealth,
  recommendedReorderQuantity,
} from '../utils/inventoryHealth.js';

const ADJUSTMENT_TYPES = ['INITIAL_STOCK', 'STOCK_ADJUSTMENT'] as const;
type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

const productInventorySelect = {
  id: true,
  sku: true,
  name: true,
  status: true,
  unitType: true,
  reorderPoint: true,
  category: { select: { id: true, name: true } },
  stockLevel: { select: { currentQuantity: true, updatedAt: true } },
} as const;

function getProductId(request: Request): string {
  const raw = request.params.productId;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

function serializeInventory(product: {
  id: string;
  sku: string;
  name: string;
  status: string;
  unitType: string;
  reorderPoint: number | null;
  category: { id: string; name: string };
  stockLevel: { currentQuantity: number; updatedAt: Date } | null;
}) {
  if (!product.stockLevel) return null;

  const currentQuantity = product.stockLevel.currentQuantity;

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    status: product.status,
    unitType: product.unitType,
    reorderPoint: product.reorderPoint,
    stockHealth: classifyStockHealth(currentQuantity, product.reorderPoint),
    recommendedReorderQuantity: recommendedReorderQuantity(currentQuantity, product.reorderPoint),
    category: product.category,
    currentQuantity,
    updatedAt: product.stockLevel.updatedAt,
  };
}

function productEntityLabel(product: { sku: string; name: string }) {
  return `${product.sku} - ${product.name}`;
}

export async function listInventory(_request: Request, response: Response) {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: productInventorySelect,
    });
    const inventory = products.map(serializeInventory);

    if (inventory.some((item) => item === null)) {
      response.status(500).json({ message: 'Inventory data is not ready' });
      return;
    }

    response.json({ inventory });
  } catch (error) {
    logError('Listing inventory failed', error);
    response.status(500).json({ message: 'Unable to load inventory' });
  }
}

export async function getInventory(request: Request, response: Response) {
  const productId = getProductId(request);

  if (!productId) {
    response.status(404).json({ message: 'Product not found' });
    return;
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        ...productInventorySelect,
        inventoryMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            quantityChange: true,
            movementType: true,
            note: true,
            createdAt: true,
            performedBy: { select: { id: true, fullName: true, username: true, email: true } },
          },
        },
      },
    });

    if (!product) {
      response.status(404).json({ message: 'Product not found' });
      return;
    }

    const inventory = serializeInventory(product);
    if (!inventory) {
      response.status(500).json({ message: 'Inventory data is not ready' });
      return;
    }

    response.json({ inventory, movements: product.inventoryMovements });
  } catch (error) {
    logError('Loading inventory failed', error);
    response.status(500).json({ message: 'Unable to load inventory' });
  }
}

export async function listInventoryMovements(request: Request, response: Response) {
  const { productId, movementType, performedById, from, to } = request.query;
  const createdAt: { gte?: Date; lte?: Date } = {};

  if (typeof from === 'string' && !Number.isNaN(Date.parse(from))) {
    createdAt.gte = new Date(from);
  }
  if (typeof to === 'string' && !Number.isNaN(Date.parse(to))) {
    createdAt.lte = new Date(to);
  }

  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        ...(typeof productId === 'string' ? { productId } : {}),
        ...(typeof movementType === 'string' ? { movementType: movementType as never } : {}),
        ...(typeof performedById === 'string' ? { performedById } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        quantityChange: true,
        movementType: true,
        unitCostCents: true,
        note: true,
        createdAt: true,
        product: { select: { id: true, sku: true, name: true } },
        performedBy: { select: { id: true, fullName: true, username: true, email: true } },
        saleItem: {
          select: {
            id: true,
            sale: { select: { id: true, saleNumber: true } },
          },
        },
      },
    });

    response.json({ movements });
  } catch (error) {
    logError('Listing inventory movements failed', error);
    response.status(500).json({ message: 'Unable to load inventory movements' });
  }
}

export async function adjustInventory(request: Request, response: Response) {
  const productId = getProductId(request);
  const quantityChange = request.body?.quantityChange;
  const type = typeof request.body?.type === 'string' ? request.body.type : 'STOCK_ADJUSTMENT';
  const note = typeof request.body?.note === 'string' ? request.body.note.trim() : null;

  if (!Number.isInteger(quantityChange) || quantityChange === 0) {
    response.status(400).json({ message: 'quantityChange must be a non-zero integer' });
    return;
  }

  if (!ADJUSTMENT_TYPES.includes(type as AdjustmentType)) {
    response.status(400).json({ message: 'Invalid inventory adjustment type' });
    return;
  }

  if (note && note.length > 500) {
    response.status(400).json({ message: 'Note must be 500 characters or fewer' });
    return;
  }

  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }
  const performedById = request.authUser.id;

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: productId },
          select: { id: true, sku: true, name: true },
        });
        if (!product) return 'PRODUCT_NOT_FOUND' as const;

        const stockLevel = await transaction.stockLevel.findUnique({
          where: { productId },
          select: { id: true, currentQuantity: true },
        });
        if (!stockLevel) return 'STOCK_LEVEL_MISSING' as const;
        const previousQuantity = stockLevel.currentQuantity;

        const updatedCount = quantityChange > 0
          ? (await transaction.stockLevel.updateMany({
              where: { productId },
              data: { currentQuantity: { increment: quantityChange } },
            })).count
          : (await transaction.stockLevel.updateMany({
              where: { productId, currentQuantity: { gte: Math.abs(quantityChange) } },
              data: { currentQuantity: { decrement: Math.abs(quantityChange) } },
            })).count;

        if (updatedCount !== 1) return 'NEGATIVE_STOCK' as const;

        const movement = await transaction.inventoryMovement.create({
          data: {
            productId,
            quantityChange,
            movementType: type as AdjustmentType,
            performedById,
            note: note || undefined,
          },
          select: {
            id: true,
            quantityChange: true,
            movementType: true,
            note: true,
            createdAt: true,
          },
        });
        const updatedStockLevel = await transaction.stockLevel.findUniqueOrThrow({
          where: { productId },
          select: { currentQuantity: true, updatedAt: true },
        });

        await recordAuditEvent(
          {
            request,
            eventType: AuditEventType.ADMIN_ACTION,
            action: AuditAction.UPDATE,
            entityType: AuditEntityType.INVENTORY,
            entityId: product.id,
            entityLabel: productEntityLabel(product),
            actorUserId: performedById,
            before: { currentQuantity: previousQuantity },
            after: { currentQuantity: updatedStockLevel.currentQuantity },
            metadata: {
              operation: 'INVENTORY_ADJUSTED',
              quantityChange,
              movementType: movement.movementType,
              previousQuantity,
              newQuantity: updatedStockLevel.currentQuantity,
              movementId: movement.id,
              noteProvided: Boolean(note),
            },
          },
          transaction,
        );

        return { movement, stockLevel: updatedStockLevel };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result === 'PRODUCT_NOT_FOUND') {
      response.status(404).json({ message: 'Product not found' });
      return;
    }
    if (result === 'STOCK_LEVEL_MISSING') {
      response.status(500).json({ message: 'Inventory data is not ready' });
      return;
    }
    if (result === 'NEGATIVE_STOCK') {
      response.status(409).json({ message: 'Stock adjustment would result in negative inventory.' });
      return;
    }

    response.json({
      inventory: { productId, currentQuantity: result.stockLevel.currentQuantity, updatedAt: result.stockLevel.updatedAt },
      movement: result.movement,
    });
  } catch (error) {
    logError('Adjusting inventory failed', error);
    response.status(500).json({ message: 'Unable to adjust inventory' });
  }
}
