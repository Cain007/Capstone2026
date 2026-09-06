import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { recordAuditEvent } from '../utils/audit.js';

const PAYMENT_METHODS = ['CASH', 'CARD', 'E_WALLET', 'BANK_TRANSFER', 'OTHER'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type SaleInput = {
  productId: string;
  quantity: number;
};

type SaleUser = {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
};

class SaleTransactionAbort extends Error {
  constructor(readonly kind: 'INSUFFICIENT_STOCK') {
    super(kind);
  }
}

const saleDetailSelect = {
  id: true,
  saleNumber: true,
  soldAt: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  subtotalCents: true,
  discountCents: true,
  taxCents: true,
  grandTotalCents: true,
  cashReceivedCents: true,
  changeDueCents: true,
  customerReference: true,
  customerNameSnapshot: true,
  notes: true,
  completedAt: true,
  createdAt: true,
  cashier: { select: { id: true, email: true, fullName: true, username: true } },
  items: {
    orderBy: { lineNumber: 'asc' as const },
    select: {
      id: true,
      productId: true,
      lineNumber: true,
      productNameSnapshot: true,
      skuSnapshot: true,
      unitPriceCents: true,
      quantity: true,
      discountCents: true,
      taxCents: true,
      lineTotalCents: true,
    },
  },
} as const;

function saleNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(4).toString('hex').slice(0, 5).toUpperCase();
  return `SALE-${date}-${suffix}`;
}

function decimalToCents(value: { toString(): string }): number | null {
  const text = value.toString();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(`${match[1]}${(match[2] ?? '').padEnd(2, '0')}`);
  return Number.isSafeInteger(cents) ? cents : null;
}

function readOptionalCents(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && Number.isSafeInteger(value)
    ? value
    : Number.NaN;
}

function getSaleId(request: Request): string {
  const raw = request.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

function safeUser(user: SaleUser | null) {
  if (!user) return null;
  return { id: user.id, email: user.email, fullName: user.fullName, username: user.username };
}

function serializeSale(sale: {
  id: string;
  saleNumber: string;
  soldAt: Date;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  grandTotalCents: number;
  cashReceivedCents: number | null;
  changeDueCents: number | null;
  customerReference: string | null;
  customerNameSnapshot: string | null;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  cashier: SaleUser | null;
  items: Array<{
    id: string;
    productId: string;
    lineNumber: number;
    productNameSnapshot: string;
    skuSnapshot: string;
    unitPriceCents: number;
    quantity: unknown;
    discountCents: number;
    taxCents: number;
    lineTotalCents: number;
  }>;
}) {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    soldAt: sale.soldAt,
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    paymentStatus: sale.paymentStatus,
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    taxCents: sale.taxCents,
    grandTotalCents: sale.grandTotalCents,
    cashReceivedCents: sale.cashReceivedCents,
    changeDueCents: sale.changeDueCents,
    customerReference: sale.customerReference,
    customerName: sale.customerNameSnapshot,
    notes: sale.notes,
    completedAt: sale.completedAt,
    createdAt: sale.createdAt,
    cashier: safeUser(sale.cashier),
    items: sale.items,
  };
}

function validationError(message: string) {
  return { kind: 'VALIDATION' as const, message };
}

function saleTotalQuantity(lines: Array<{ quantity: number }>) {
  return lines.reduce((total, line) => total + line.quantity, 0).toString();
}

export async function createSale(request: Request, response: Response) {
  const rawItems = request.body?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    response.status(400).json({ message: 'At least one sale item is required' });
    return;
  }

  const quantities = new Map<string, number>();
  for (const item of rawItems as unknown[]) {
    const candidate = item as Partial<SaleInput>;
    if (typeof candidate.productId !== 'string' || !candidate.productId.trim()) {
      response.status(400).json({ message: 'Each sale item requires a productId' });
      return;
    }
    const itemQuantity = candidate.quantity;
    if (typeof itemQuantity !== 'number' || !Number.isInteger(itemQuantity) || itemQuantity <= 0) {
      response.status(400).json({ message: 'Each sale quantity must be a positive integer' });
      return;
    }
    const productId = candidate.productId.trim();
    const quantity = (quantities.get(productId) ?? 0) + itemQuantity;
    if (!Number.isSafeInteger(quantity)) {
      response.status(400).json({ message: 'Sale quantity is too large' });
      return;
    }
    quantities.set(productId, quantity);
  }

  const paymentMethod = request.body?.paymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)) {
    response.status(400).json({ message: 'Invalid payment method' });
    return;
  }
  const normalizedPaymentMethod = paymentMethod as PaymentMethod;

  const discountCents = request.body?.discountCents ?? 0;
  const taxCents = request.body?.taxCents ?? 0;
  if (!Number.isInteger(discountCents) || discountCents < 0) {
    response.status(400).json({ message: 'discountCents must be a non-negative integer' });
    return;
  }
  if (!Number.isInteger(taxCents) || taxCents < 0) {
    response.status(400).json({ message: 'taxCents must be a non-negative integer' });
    return;
  }

  const cashReceivedCents = readOptionalCents(request.body?.cashReceivedCents);
  if (Number.isNaN(cashReceivedCents)) {
    response.status(400).json({ message: 'cashReceivedCents must be a non-negative integer' });
    return;
  }

  const customerName = typeof request.body?.customerName === 'string' ? request.body.customerName.trim() : null;
  const notes = typeof request.body?.notes === 'string' ? request.body.notes.trim() : null;
  if (customerName && customerName.length > 200) {
    response.status(400).json({ message: 'customerName must be 200 characters or fewer' });
    return;
  }
  if (notes && notes.length > 500) {
    response.status(400).json({ message: 'notes must be 500 characters or fewer' });
    return;
  }
  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const cashierId = request.authUser.id;
  const productIds = [...quantities.keys()];
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (transaction) => {
          const [cashier, products] = await Promise.all([
            transaction.user.findUnique({ where: { id: cashierId }, select: { id: true, email: true } }),
            transaction.product.findMany({
              where: { id: { in: productIds } },
              select: { id: true, name: true, sku: true, status: true, price: true, stockLevel: { select: { id: true, currentQuantity: true } } },
            }),
          ]);
          if (!cashier) return { kind: 'CASHIER_NOT_FOUND' as const };
          if (products.length !== productIds.length) return { kind: 'PRODUCT_UNAVAILABLE' as const };

          const productsById = new Map(products.map((product) => [product.id, product]));
          const lines = productIds.map((productId, index) => {
            const product = productsById.get(productId);
            if (!product || product.status !== 'ACTIVE' || !product.stockLevel) return null;
            const unitPriceCents = decimalToCents(product.price);
            const quantity = quantities.get(productId) ?? 0;
            if (unitPriceCents === null || unitPriceCents < 0 || !Number.isSafeInteger(unitPriceCents * quantity)) return null;
            return { product, quantity, unitPriceCents, lineNumber: index + 1, lineTotalCents: unitPriceCents * quantity };
          });
          if (lines.some((line) => line === null)) return { kind: 'PRODUCT_UNAVAILABLE' as const };

          const validLines = lines as Array<NonNullable<(typeof lines)[number]>>;
          const subtotalCents = validLines.reduce((total, line) => total + line.lineTotalCents, 0);
          const grandTotalCents = subtotalCents - discountCents + taxCents;
          if (!Number.isSafeInteger(subtotalCents) || discountCents > subtotalCents || grandTotalCents < 0) return validationError('Discount cannot exceed the sale subtotal');
          let saleCashReceivedCents: number | null = null;
          let changeDueCents: number | null = null;
          if (normalizedPaymentMethod === 'CASH') {
            if (cashReceivedCents === null) {
              return validationError('Cash received is required for cash payments.');
            }
            if (cashReceivedCents < grandTotalCents) {
              return validationError('Cash received must be at least the sale total.');
            }
            saleCashReceivedCents = cashReceivedCents;
            changeDueCents = cashReceivedCents - grandTotalCents;
          }

          const now = new Date();
          const generatedSaleNumber = saleNumber();
          const sale = await transaction.sale.create({
            data: {
              saleNumber: generatedSaleNumber,
              soldAt: now,
              status: 'COMPLETED',
              cashierId,
              cashierUserIdSnapshot: cashier.id,
              cashierEmailSnapshot: cashier.email,
              customerNameSnapshot: customerName || undefined,
              notes: notes || undefined,
              paymentStatus: 'PAID',
              paymentMethod: normalizedPaymentMethod,
              subtotalCents,
              discountCents,
              taxCents,
              grandTotalCents,
              cashReceivedCents: saleCashReceivedCents,
              changeDueCents,
              completedAt: now,
            },
            select: { id: true },
          });

          for (const line of validLines) {
            const updated = await transaction.stockLevel.updateMany({
              where: { productId: line.product.id, currentQuantity: { gte: line.quantity } },
              data: { currentQuantity: { decrement: line.quantity } },
            });
            if (updated.count !== 1) throw new SaleTransactionAbort('INSUFFICIENT_STOCK');

            const saleItem = await transaction.saleItem.create({
              data: {
                saleId: sale.id,
                productId: line.product.id,
                lineNumber: line.lineNumber,
                productNameSnapshot: line.product.name,
                skuSnapshot: line.product.sku,
                unitPriceCents: line.unitPriceCents,
                quantity: line.quantity,
                discountCents: 0,
                taxCents: 0,
                lineTotalCents: line.lineTotalCents,
              },
              select: { id: true },
            });
            await transaction.inventoryMovement.create({
              data: {
                productId: line.product.id,
                quantityChange: -line.quantity,
                movementType: 'SALE_DEDUCTION',
                performedById: cashierId,
                saleItemId: saleItem.id,
                note: `Sale ${generatedSaleNumber}`,
              },
            });
          }

          const createdSale = await transaction.sale.findUniqueOrThrow({ where: { id: sale.id }, select: saleDetailSelect });
          await recordAuditEvent(
            {
              request,
              eventType: AuditEventType.DATA_CHANGE,
              action: AuditAction.CREATE,
              entityType: AuditEntityType.SALE,
              entityId: createdSale.id,
              entityLabel: createdSale.saleNumber,
              actorUserId: cashierId,
              after: {
                saleNumber: createdSale.saleNumber,
                status: createdSale.status,
                paymentStatus: createdSale.paymentStatus,
                paymentMethod: createdSale.paymentMethod,
                grandTotalCents: createdSale.grandTotalCents,
                cashReceivedCents: createdSale.cashReceivedCents,
                changeDueCents: createdSale.changeDueCents,
              },
              metadata: {
                operation: 'SALE_COMPLETED',
                saleNumber: createdSale.saleNumber,
                itemCount: validLines.length,
                totalQuantity: saleTotalQuantity(validLines),
                paymentMethod: createdSale.paymentMethod,
                subtotalCents: createdSale.subtotalCents,
                discountCents: createdSale.discountCents,
                taxCents: createdSale.taxCents,
                grandTotalCents: createdSale.grandTotalCents,
                cashReceivedCents: createdSale.cashReceivedCents,
                changeDueCents: createdSale.changeDueCents,
              },
            },
            transaction,
          );

          return createdSale;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if ('kind' in result && result.kind === 'CASHIER_NOT_FOUND') {
        response.status(401).json({ message: 'User no longer exists' });
        return;
      }
      if ('kind' in result && result.kind === 'PRODUCT_UNAVAILABLE') {
        response.status(409).json({ message: 'One or more products are unavailable for sale.' });
        return;
      }
      if ('kind' in result && result.kind === 'VALIDATION') {
        response.status(400).json({ message: result.message });
        return;
      }

      response.status(201).json({ sale: serializeSale(result) });
      return;
    } catch (error) {
      lastError = error;
      if (error instanceof SaleTransactionAbort) break;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) break;
    }
  }

  if (lastError instanceof SaleTransactionAbort && lastError.kind === 'INSUFFICIENT_STOCK') {
    response.status(409).json({ message: 'Insufficient stock for one or more products.' });
    return;
  }

  if (lastError instanceof Prisma.PrismaClientKnownRequestError && lastError.code === 'P2002') {
    response.status(409).json({ message: 'Unable to generate a unique sale number. Please try again.' });
    return;
  }
  console.error('Creating sale failed:', lastError);
  response.status(500).json({ message: 'Unable to create sale' });
}

export async function listSales(request: Request, response: Response) {
  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }
  try {
    const sales = await prisma.sale.findMany({
      where: request.authUser.role === 'Staff' ? { cashierId: request.authUser.id } : undefined,
      orderBy: { soldAt: 'desc' },
      select: {
        id: true, saleNumber: true, soldAt: true, status: true, paymentMethod: true, paymentStatus: true,
        subtotalCents: true, discountCents: true, taxCents: true, grandTotalCents: true,
        cashReceivedCents: true, changeDueCents: true, createdAt: true,
        cashier: { select: { id: true, email: true, fullName: true, username: true } },
        _count: { select: { items: true } },
      },
    });
    response.json({ sales: sales.map((sale) => ({ ...sale, cashier: safeUser(sale.cashier), itemCount: sale._count.items, _count: undefined })) });
  } catch (error) {
    console.error('Listing sales failed:', error);
    response.status(500).json({ message: 'Unable to load sales' });
  }
}

export async function getSale(request: Request, response: Response) {
  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }
  const id = getSaleId(request);
  try {
    const sale = await prisma.sale.findFirst({
      where: { id, ...(request.authUser.role === 'Staff' ? { cashierId: request.authUser.id } : {}) },
      select: saleDetailSelect,
    });
    if (!sale) {
      response.status(404).json({ message: 'Sale not found' });
      return;
    }
    response.json({ sale: serializeSale(sale) });
  } catch (error) {
    console.error('Loading sale failed:', error);
    response.status(500).json({ message: 'Unable to load sale' });
  }
}
