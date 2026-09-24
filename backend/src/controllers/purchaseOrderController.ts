import type { Request, Response } from 'express';
import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  Prisma,
  PurchaseOrderStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { recordAuditEvent } from '../utils/audit.js';
import { logError } from '../utils/safeLogger.js';

const ALLOWED_CREATE_STATUSES = new Set<PurchaseOrderStatus>([
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.ORDERED,
]);
const ALL_PURCHASE_ORDER_STATUSES = new Set<PurchaseOrderStatus>([
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.ORDERED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
  PurchaseOrderStatus.RECEIVED,
  PurchaseOrderStatus.CANCELLED,
]);
const RECEIVABLE_STATUSES = new Set<PurchaseOrderStatus>([
  PurchaseOrderStatus.ORDERED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
]);
const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;
const MAX_RECEIPT_NOTE_LENGTH = 500;
const MAX_RECEIVE_ATTEMPTS = 3;

class DomainResponseError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type PurchaseOrderWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: typeof purchaseOrderDetailInclude;
}>;

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  username: true,
} as const satisfies Prisma.UserSelect;

const purchaseOrderDetailInclude = {
  supplier: {
    select: {
      id: true,
      supplierCode: true,
      name: true,
      status: true,
    },
  },
  createdBy: {
    select: userSelect,
  },
  updatedBy: {
    select: userSelect,
  },
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      productId: true,
      productNameSnapshot: true,
      skuSnapshot: true,
      quantityOrdered: true,
      quantityReceived: true,
      unitCostCents: true,
      lineTotalCents: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const satisfies Prisma.PurchaseOrderInclude;

const purchaseOrderListSelect = {
  id: true,
  poNumber: true,
  status: true,
  subtotalCents: true,
  orderedAt: true,
  expectedDeliveryDate: true,
  receivedAt: true,
  createdAt: true,
  supplier: {
    select: {
      id: true,
      supplierCode: true,
      name: true,
    },
  },
  createdBy: {
    select: userSelect,
  },
  _count: {
    select: { items: true },
  },
} as const satisfies Prisma.PurchaseOrderSelect;

function serializeUser(user: {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
} | null) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
  };
}

function serializePurchaseOrder(purchaseOrder: PurchaseOrderWithRelations) {
  return {
    id: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    supplier: purchaseOrder.supplier,
    status: purchaseOrder.status,
    subtotalCents: purchaseOrder.subtotalCents,
    orderedAt: purchaseOrder.orderedAt,
    expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
    receivedAt: purchaseOrder.receivedAt,
    cancelledAt: purchaseOrder.cancelledAt,
    notes: purchaseOrder.notes,
    createdBy: serializeUser(purchaseOrder.createdBy),
    updatedBy: serializeUser(purchaseOrder.updatedBy),
    createdAt: purchaseOrder.createdAt,
    updatedAt: purchaseOrder.updatedAt,
    items: purchaseOrder.items.map((item) => ({
      ...item,
      remainingQuantity: item.quantityOrdered - item.quantityReceived,
    })),
  };
}

function getPurchaseOrderId(request: Request): string {
  const raw = request.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function readOptionalDate(value: unknown): { ok: true; value: Date | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }

  if (typeof value !== 'string') {
    return { ok: false, message: 'Expected delivery date must be a valid date' };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, message: 'Expected delivery date must be a valid date' };
  }

  return { ok: true, value: parsed };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateToIsoString(date: Date | null) {
  return date ? date.toISOString() : null;
}

function totalReceivedQuantity(
  received: Array<{ quantityReceived: number }>,
) {
  return received.reduce((sum, item) => sum + item.quantityReceived, 0);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isPurchaseOrderStatus(value: string): value is PurchaseOrderStatus {
  return ALL_PURCHASE_ORDER_STATUSES.has(value as PurchaseOrderStatus);
}

function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function movementNote(poNumber: string, note: string | null): string {
  const base = `Received against ${poNumber}`;
  return note ? `${base}: ${note}` : base;
}

function generatePoNumber(): string {
  const now = new Date();
  const businessDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now).replaceAll('-', '');
  const suffix = Array.from({ length: 5 }, () =>
    Math.floor(Math.random() * 36).toString(36).toUpperCase(),
  ).join('');

  return `PO-${businessDate}-${suffix}`;
}

async function createUniquePoNumber(transaction: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const poNumber = generatePoNumber();
    const existing = await transaction.purchaseOrder.findUnique({
      where: { poNumber },
      select: { id: true },
    });

    if (!existing) return poNumber;
  }

  throw new Error('Unable to generate unique purchase order number');
}

export async function createPurchaseOrder(request: Request, response: Response) {
  const supplierId = readTrimmedString(request.body?.supplierId);
  if (!supplierId) {
    response.status(400).json({ message: 'Supplier ID is required' });
    return;
  }

  const rawStatus = typeof request.body?.status === 'string' && request.body.status
    ? request.body.status
    : PurchaseOrderStatus.DRAFT;

  if (!isPurchaseOrderStatus(rawStatus) || !ALLOWED_CREATE_STATUSES.has(rawStatus)) {
    response.status(400).json({ message: 'Purchase order status must be DRAFT or ORDERED' });
    return;
  }

  const status = rawStatus;
  const expectedDeliveryDate = readOptionalDate(request.body?.expectedDeliveryDate);
  if (!expectedDeliveryDate.ok) {
    response.status(400).json({ message: expectedDeliveryDate.message });
    return;
  }

  const orderedAt = status === 'ORDERED' ? new Date() : null;
  if (
    expectedDeliveryDate.value &&
    orderedAt &&
    startOfUtcDay(expectedDeliveryDate.value) < startOfUtcDay(orderedAt)
  ) {
    response.status(400).json({ message: 'Expected delivery date cannot be before the order date' });
    return;
  }

  const rawItems = request.body?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    response.status(400).json({ message: 'At least one purchase order item is required' });
    return;
  }

  const seenProductIds = new Set<string>();
  const requestedItems: Array<{
    productId: string;
    quantityOrdered: number;
    unitCostCents: number;
    lineTotalCents: number;
  }> = [];

  for (const item of rawItems) {
    const productId = readTrimmedString(item?.productId);
    if (!productId) {
      response.status(400).json({ message: 'Product ID is required for every item' });
      return;
    }

    if (seenProductIds.has(productId)) {
      response.status(400).json({ message: 'Duplicate products are not allowed in a purchase order.' });
      return;
    }
    seenProductIds.add(productId);

    if (!isPositiveInteger(item?.quantityOrdered)) {
      response.status(400).json({ message: 'Quantity ordered must be a positive integer' });
      return;
    }

    if (!isNonNegativeInteger(item?.unitCostCents)) {
      response.status(400).json({ message: 'Unit cost must be an integer number of cents' });
      return;
    }

    const lineTotalCents = item.quantityOrdered * item.unitCostCents;
    if (!Number.isSafeInteger(lineTotalCents) || lineTotalCents > MAX_SAFE_CENTS) {
      response.status(400).json({ message: 'Line total exceeds supported money limits' });
      return;
    }

    requestedItems.push({
      productId,
      quantityOrdered: item.quantityOrdered,
      unitCostCents: item.unitCostCents,
      lineTotalCents,
    });
  }

  const subtotalCents = requestedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > MAX_SAFE_CENTS) {
    response.status(400).json({ message: 'Purchase order subtotal exceeds supported money limits' });
    return;
  }

  try {
    const purchaseOrderResult = await prisma.$transaction(async (transaction): Promise<
      | { purchaseOrder: PurchaseOrderWithRelations }
      | { error: { status: number; message: string } }
    > => {
      const supplier = await transaction.supplier.findUnique({
        where: { id: supplierId },
        select: {
          id: true,
          status: true,
          name: true,
        },
      });

      if (!supplier) {
        return { error: { status: 404, message: 'Supplier not found' } } as const;
      }

      if (supplier.status !== 'ACTIVE') {
        return {
          error: { status: 409, message: 'Only active suppliers can be used for purchase orders' },
        } as const;
      }

      const products = await transaction.product.findMany({
        where: { id: { in: requestedItems.map((item) => item.productId) } },
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
        },
      });
      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const item of requestedItems) {
        const product = productsById.get(item.productId);
        if (!product) {
          return { error: { status: 404, message: 'Product not found' } } as const;
        }

        if (product.status !== 'ACTIVE') {
          return {
            error: { status: 409, message: 'Only active products can be used for purchase orders' },
          } as const;
        }
      }

      const poNumber = await createUniquePoNumber(transaction);

      const created = await transaction.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          status,
          orderedAt: orderedAt ?? undefined,
          expectedDeliveryDate: expectedDeliveryDate.value ?? undefined,
          notes: readTrimmedString(request.body?.notes) || undefined,
          subtotalCents,
          createdById: request.authUser?.id,
          updatedById: request.authUser?.id,
          items: {
            create: requestedItems.map((item) => {
              const product = productsById.get(item.productId);
              if (!product) throw new Error('Validated product missing during PO create');

              return {
                productId: item.productId,
                quantityOrdered: item.quantityOrdered,
                unitCostCents: item.unitCostCents,
                lineTotalCents: item.lineTotalCents,
                productNameSnapshot: product.name,
                skuSnapshot: product.sku,
              };
            }),
          },
        },
        include: purchaseOrderDetailInclude,
      });

      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.DATA_CHANGE,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.PURCHASE_ORDER,
          entityId: created.id,
          entityLabel: created.poNumber,
          actorUserId: request.authUser?.id ?? null,
          after: {
            poNumber: created.poNumber,
            status: created.status,
            supplierId: created.supplier.id,
            subtotalCents: created.subtotalCents,
            itemCount: created.items.length,
          },
          metadata: {
            operation: 'PURCHASE_ORDER_CREATED',
            poNumber: created.poNumber,
            supplierId: created.supplier.id,
            supplierName: created.supplier.name,
            status: created.status,
            itemCount: created.items.length,
            subtotalCents: created.subtotalCents,
            expectedDeliveryDate: dateToIsoString(created.expectedDeliveryDate),
          },
        },
        transaction,
      );

      return { purchaseOrder: created } as const;
    });

    if ('error' in purchaseOrderResult) {
      response.status(purchaseOrderResult.error.status).json({ message: purchaseOrderResult.error.message });
      return;
    }

    response.status(201).json({ purchaseOrder: serializePurchaseOrder(purchaseOrderResult.purchaseOrder) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({ message: 'Purchase order number conflict. Please try again.' });
      return;
    }

    logError('Creating purchase order failed', error);
    response.status(500).json({ message: 'Unable to create purchase order' });
  }
}

export async function listPurchaseOrders(request: Request, response: Response) {
  const status = typeof request.query.status === 'string' ? request.query.status : undefined;
  if (status && !isPurchaseOrderStatus(status)) {
    response.status(400).json({ message: 'Invalid purchase order status filter' });
    return;
  }
  const statusFilter = status ? (status as PurchaseOrderStatus) : undefined;

  const supplierId = typeof request.query.supplierId === 'string' && request.query.supplierId.trim()
    ? request.query.supplierId.trim()
    : undefined;

  try {
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        status: statusFilter,
        supplierId,
      },
      orderBy: { createdAt: 'desc' },
      select: purchaseOrderListSelect,
    });

    response.json({
      purchaseOrders: purchaseOrders.map((purchaseOrder) => ({
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        supplier: purchaseOrder.supplier,
        status: purchaseOrder.status,
        subtotalCents: purchaseOrder.subtotalCents,
        itemCount: purchaseOrder._count.items,
        orderedAt: purchaseOrder.orderedAt,
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
        receivedAt: purchaseOrder.receivedAt,
        createdAt: purchaseOrder.createdAt,
        createdBy: serializeUser(purchaseOrder.createdBy),
      })),
    });
  } catch (error) {
    logError('Listing purchase orders failed', error);
    response.status(500).json({ message: 'Unable to load purchase orders' });
  }
}

export async function getPurchaseOrder(request: Request, response: Response) {
  const id = getPurchaseOrderId(request);

  if (!id) {
    response.status(404).json({ message: 'Purchase order not found' });
    return;
  }

  try {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: purchaseOrderDetailInclude,
    });

    if (!purchaseOrder) {
      response.status(404).json({ message: 'Purchase order not found' });
      return;
    }

    response.json({ purchaseOrder: serializePurchaseOrder(purchaseOrder) });
  } catch (error) {
    logError('Loading purchase order failed', error);
    response.status(500).json({ message: 'Unable to load purchase order' });
  }
}

export async function orderPurchaseOrder(request: Request, response: Response) {
  const id = getPurchaseOrderId(request);

  if (!id) {
    response.status(404).json({ message: 'Purchase order not found' });
    return;
  }

  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const actorUserId = request.authUser.id;
  const orderedAt = new Date();

  try {
    const purchaseOrder = await prisma.$transaction(async (transaction): Promise<PurchaseOrderWithRelations> => {
      const current = await transaction.purchaseOrder.findUnique({
        where: { id },
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          status: true,
          orderedAt: true,
        },
      });

      if (!current) {
        throw new DomainResponseError(404, 'Purchase order not found');
      }

      if (current.status !== PurchaseOrderStatus.DRAFT) {
        throw new DomainResponseError(409, 'Only draft purchase orders can be marked as ordered.');
      }

      const updateResult = await transaction.purchaseOrder.updateMany({
        where: {
          id,
          status: PurchaseOrderStatus.DRAFT,
        },
        data: {
          status: PurchaseOrderStatus.ORDERED,
          orderedAt,
          updatedById: actorUserId,
        },
      });

      if (updateResult.count !== 1) {
        throw new DomainResponseError(409, 'Only draft purchase orders can be marked as ordered.');
      }

      const updated = await transaction.purchaseOrder.findUnique({
        where: { id },
        include: purchaseOrderDetailInclude,
      });

      if (!updated) {
        throw new DomainResponseError(404, 'Purchase order not found');
      }

      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.DATA_CHANGE,
          action: AuditAction.UPDATE,
          entityType: AuditEntityType.PURCHASE_ORDER,
          entityId: updated.id,
          entityLabel: updated.poNumber,
          actorUserId,
          before: {
            status: PurchaseOrderStatus.DRAFT,
            orderedAt: dateToIsoString(current.orderedAt),
          },
          after: {
            status: updated.status,
            orderedAt: dateToIsoString(updated.orderedAt),
          },
          metadata: {
            operation: 'PURCHASE_ORDER_ORDERED',
            poNumber: updated.poNumber,
            supplierId: current.supplierId,
          },
        },
        transaction,
      );

      return updated;
    });

    response.json({ purchaseOrder: serializePurchaseOrder(purchaseOrder) });
  } catch (error) {
    if (error instanceof DomainResponseError) {
      response.status(error.status).json({ message: error.message });
      return;
    }

    logError('Marking purchase order as ordered failed', error);
    response.status(500).json({ message: 'Unable to mark purchase order as ordered' });
  }
}

export async function receivePurchaseOrder(request: Request, response: Response) {
  const id = getPurchaseOrderId(request);

  if (!id) {
    response.status(404).json({ message: 'Purchase order not found' });
    return;
  }

  const rawItems = request.body?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    response.status(400).json({ message: 'At least one received item is required' });
    return;
  }

  const note = readTrimmedString(request.body?.note);
  if (note && note.length > MAX_RECEIPT_NOTE_LENGTH) {
    response.status(400).json({ message: `Note must be ${MAX_RECEIPT_NOTE_LENGTH} characters or fewer` });
    return;
  }

  const seenItemIds = new Set<string>();
  const requestedItems: Array<{ purchaseOrderItemId: string; quantityReceived: number }> = [];

  for (const item of rawItems) {
    const purchaseOrderItemId = readTrimmedString(item?.purchaseOrderItemId);
    if (!purchaseOrderItemId) {
      response.status(400).json({ message: 'Purchase order item ID is required for every received item' });
      return;
    }

    if (seenItemIds.has(purchaseOrderItemId)) {
      response.status(400).json({ message: 'Duplicate purchase order items are not allowed in one receipt.' });
      return;
    }
    seenItemIds.add(purchaseOrderItemId);

    if (!isPositiveInteger(item?.quantityReceived)) {
      response.status(400).json({ message: 'Received quantity must be a positive integer' });
      return;
    }

    requestedItems.push({
      purchaseOrderItemId,
      quantityReceived: item.quantityReceived,
    });
  }

  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const performedById = request.authUser.id;

  for (let attempt = 0; attempt < MAX_RECEIVE_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (transaction): Promise<
          {
            purchaseOrder: PurchaseOrderWithRelations;
            received: Array<{
              purchaseOrderItemId: string;
              productId: string;
              quantityReceived: number;
              movementId: string;
            }>;
          }
        > => {
          const purchaseOrder = await transaction.purchaseOrder.findUnique({
            where: { id },
            select: {
              id: true,
              poNumber: true,
              status: true,
              items: {
                select: {
                  id: true,
                  productId: true,
                  quantityOrdered: true,
                  quantityReceived: true,
                  unitCostCents: true,
                },
              },
            },
          });

          if (!purchaseOrder) {
            throw new DomainResponseError(404, 'Purchase order not found');
          }

          if (!RECEIVABLE_STATUSES.has(purchaseOrder.status)) {
            throw new DomainResponseError(409, 'Purchase order is not receivable in its current status');
          }

          const itemsById = new Map(purchaseOrder.items.map((item) => [item.id, item]));

          for (const item of requestedItems) {
            const purchaseOrderItem = itemsById.get(item.purchaseOrderItemId);
            if (!purchaseOrderItem) {
              throw new DomainResponseError(404, 'Purchase order item not found for this purchase order');
            }

            const remainingQuantity =
              purchaseOrderItem.quantityOrdered - purchaseOrderItem.quantityReceived;
            if (item.quantityReceived > remainingQuantity) {
              throw new DomainResponseError(409, 'Received quantity exceeds the remaining ordered quantity.');
            }
          }

          const received: Array<{
            purchaseOrderItemId: string;
            productId: string;
            quantityReceived: number;
            movementId: string;
          }> = [];

          for (const item of requestedItems) {
            const purchaseOrderItem = itemsById.get(item.purchaseOrderItemId);
            if (!purchaseOrderItem) throw new Error('Validated PO item missing during receiving');

            const remainingQuantity =
              purchaseOrderItem.quantityOrdered - purchaseOrderItem.quantityReceived;
            const updateResult = await transaction.purchaseOrderItem.updateMany({
              where: {
                id: item.purchaseOrderItemId,
                purchaseOrderId: id,
                quantityReceived: { lte: purchaseOrderItem.quantityOrdered - item.quantityReceived },
              },
              data: {
                quantityReceived: { increment: item.quantityReceived },
              },
            });

            if (updateResult.count !== 1 || item.quantityReceived > remainingQuantity) {
              throw new DomainResponseError(409, 'Received quantity exceeds the remaining ordered quantity.');
            }

            const stockUpdate = await transaction.stockLevel.updateMany({
              where: { productId: purchaseOrderItem.productId },
              data: { currentQuantity: { increment: item.quantityReceived } },
            });

            if (stockUpdate.count !== 1) {
              throw new DomainResponseError(500, 'Inventory data is not ready');
            }

            const movement = await transaction.inventoryMovement.create({
              data: {
                productId: purchaseOrderItem.productId,
                quantityChange: item.quantityReceived,
                movementType: 'PURCHASE_RECEIPT',
                unitCostCents: purchaseOrderItem.unitCostCents,
                performedById,
                purchaseOrderItemId: item.purchaseOrderItemId,
                note: movementNote(purchaseOrder.poNumber, note),
              },
              select: { id: true },
            });

            received.push({
              purchaseOrderItemId: item.purchaseOrderItemId,
              productId: purchaseOrderItem.productId,
              quantityReceived: item.quantityReceived,
              movementId: movement.id,
            });
          }

          const allItems = await transaction.purchaseOrderItem.findMany({
            where: { purchaseOrderId: id },
            select: {
              quantityOrdered: true,
              quantityReceived: true,
            },
          });

          const allReceived = allItems.every((item) => item.quantityReceived === item.quantityOrdered);
          const anyReceived = allItems.some((item) => item.quantityReceived > 0);
          const nextStatus = allReceived
            ? PurchaseOrderStatus.RECEIVED
            : anyReceived
              ? PurchaseOrderStatus.PARTIALLY_RECEIVED
              : purchaseOrder.status;
          const now = new Date();

          const updatedPurchaseOrder = await transaction.purchaseOrder.update({
            where: { id },
            data: {
              status: nextStatus,
              receivedAt: nextStatus === PurchaseOrderStatus.RECEIVED ? now : null,
              updatedById: performedById,
            },
            include: purchaseOrderDetailInclude,
          });

          const totalQuantityReceived = totalReceivedQuantity(received);
          await recordAuditEvent(
            {
              request,
              eventType: AuditEventType.DATA_CHANGE,
              action: AuditAction.UPDATE,
              entityType: AuditEntityType.PURCHASE_ORDER,
              entityId: updatedPurchaseOrder.id,
              entityLabel: updatedPurchaseOrder.poNumber,
              actorUserId: performedById,
              before: { status: purchaseOrder.status },
              after: {
                status: updatedPurchaseOrder.status,
                receivedAt: dateToIsoString(updatedPurchaseOrder.receivedAt),
              },
              metadata: {
                operation: 'PURCHASE_ORDER_RECEIVED',
                poNumber: updatedPurchaseOrder.poNumber,
                receivedLineCount: received.length,
                totalQuantityReceived,
                movementIds: received.map((item) => item.movementId),
                previousStatus: purchaseOrder.status,
                newStatus: updatedPurchaseOrder.status,
              },
            },
            transaction,
          );

          return { purchaseOrder: updatedPurchaseOrder, received };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      response.json({
        purchaseOrder: serializePurchaseOrder(result.purchaseOrder),
        received: result.received,
      });
      return;
    } catch (error) {
      if (error instanceof DomainResponseError) {
        response.status(error.status).json({ message: error.message });
        return;
      }

      if (isWriteConflict(error) && attempt < MAX_RECEIVE_ATTEMPTS - 1) {
        continue;
      }

      if (isWriteConflict(error)) {
        response.status(409).json({ message: 'Purchase order receipt conflicted with another update. Please retry.' });
        return;
      }

      logError('Receiving purchase order failed', error);
      response.status(500).json({ message: 'Unable to receive purchase order' });
      return;
    }
  }
}
