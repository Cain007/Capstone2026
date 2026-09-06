import {
  ForecastGranularity,
  ForecastMethod,
  ForecastScope,
  Prisma,
  ProductStatus,
  PurchaseOrderStatus,
  SaleStatus,
} from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  addDays,
  dateRange,
  manilaDateKey,
  manilaDayStartUtc,
} from '../utils/forecasting.js';
import {
  calculateDaysOfStockRemaining,
  calculateEstimatedStockoutDate,
  calculateForecastDemandForHorizon,
  calculatePredictiveReorderQuantity,
  classifyForecastRisk,
  type ForecastRisk,
  readForecastInsightParameters,
} from '../utils/inventoryForecastInsights.js';
import {
  classifyStockHealth,
  recommendedReorderQuantity,
  type StockHealth,
} from '../utils/inventoryHealth.js';

const TREND_DAYS = 7;
const LOW_STOCK_LIMIT = 10;
const UPCOMING_DELIVERY_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 5;
const PREDICTIVE_ATTENTION_LIMIT = 8;
const OPEN_PO_STATUSES = [
  PurchaseOrderStatus.ORDERED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
] as const;
const ATTENTION_STOCK_HEALTH: StockHealth[] = [
  'OUT_OF_STOCK',
  'CRITICAL',
  'LOW',
  'UNCONFIGURED',
];
const STOCK_HEALTH_PRIORITY = new Map<StockHealth, number>([
  ['OUT_OF_STOCK', 0],
  ['CRITICAL', 1],
  ['LOW', 2],
  ['UNCONFIGURED', 3],
  ['HEALTHY', 4],
]);
const PREDICTIVE_ATTENTION_RISKS: ForecastRisk[] = [
  'OUT_OF_STOCK',
  'CRITICAL',
  'AT_RISK',
  'NO_FORECAST',
];
const PREDICTIVE_RISK_PRIORITY = new Map<ForecastRisk, number>([
  ['OUT_OF_STOCK', 0],
  ['CRITICAL', 1],
  ['AT_RISK', 2],
  ['NO_FORECAST', 3],
  ['NO_DEMAND', 4],
  ['STABLE', 5],
]);

type SalesTrendPoint = {
  date: string;
  revenueCents: number;
  transactions: number;
};

type ProductInventory = {
  id: string;
  sku: string;
  name: string;
  unitType: string;
  reorderPoint: number | null;
  stockLevel: { currentQuantity: number } | null;
};

type PredictiveProduct = {
  id: string;
  sku: string;
  name: string;
  stockLevel: { currentQuantity: number } | null;
};

type LatestForecastRun = {
  id: string;
  productId: string | null;
  horizonPeriods: number;
  parameters: Prisma.JsonValue;
  generatedAt: Date;
};

type PredictiveAttentionProduct = {
  productId: string;
  sku: string;
  name: string;
  currentQuantity: number;
  risk: ForecastRisk;
  averageDailyDemand: number | null;
  daysOfStockRemaining: number | null;
  estimatedStockoutDate: string | null;
  predictiveReorderQuantity: number | null;
  horizonDays: number | null;
  historyDaysUsed: number | null;
  isLimitedHistory: boolean | null;
};

type RecentActivityActor = {
  email: string;
  fullName: string | null;
  username: string | null;
} | null;

function firstDayOfMonthKey(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function nextMonthKey(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 10);
}

function sumCents(records: Array<{ grandTotalCents: number }>) {
  return records.reduce((total, record) => total + record.grandTotalCents, 0);
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

function actorDisplay(actor: RecentActivityActor, actorEmailSnapshot: string | null) {
  return actor?.fullName || actor?.username || actor?.email || actorEmailSnapshot || 'System';
}

function metadataOperation(metadata: Prisma.JsonValue) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const operation = metadata.operation;
  return typeof operation === 'string' ? operation : null;
}

function serializeLowStockProduct(product: ProductInventory) {
  if (!product.stockLevel) return null;

  const currentQuantity = product.stockLevel.currentQuantity;
  const stockHealth = classifyStockHealth(currentQuantity, product.reorderPoint);

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    unitType: product.unitType,
    currentQuantity,
    reorderPoint: product.reorderPoint,
    stockHealth,
    recommendedReorderQuantity: recommendedReorderQuantity(
      currentQuantity,
      product.reorderPoint,
    ),
  };
}

function stockHealthSort(left: { stockHealth: StockHealth; currentQuantity: number; name: string; productId: string }, right: { stockHealth: StockHealth; currentQuantity: number; name: string; productId: string }) {
  const priorityDifference =
    (STOCK_HEALTH_PRIORITY.get(left.stockHealth) ?? 99) -
    (STOCK_HEALTH_PRIORITY.get(right.stockHealth) ?? 99);
  if (priorityDifference !== 0) return priorityDifference;

  if (left.currentQuantity !== right.currentQuantity) {
    return left.currentQuantity - right.currentQuantity;
  }

  const nameDifference = left.name.localeCompare(right.name);
  return nameDifference !== 0 ? nameDifference : left.productId.localeCompare(right.productId);
}

function predictiveAttentionSort(
  left: PredictiveAttentionProduct,
  right: PredictiveAttentionProduct,
) {
  const priorityDifference =
    (PREDICTIVE_RISK_PRIORITY.get(left.risk) ?? 99) -
    (PREDICTIVE_RISK_PRIORITY.get(right.risk) ?? 99);
  if (priorityDifference !== 0) return priorityDifference;

  if (left.risk === 'CRITICAL' || left.risk === 'AT_RISK') {
    const leftDays = left.daysOfStockRemaining ?? Number.POSITIVE_INFINITY;
    const rightDays = right.daysOfStockRemaining ?? Number.POSITIVE_INFINITY;
    if (leftDays !== rightDays) return leftDays - rightDays;
  }

  if (left.risk === 'OUT_OF_STOCK') {
    const quantityDifference =
      (right.predictiveReorderQuantity ?? -1) - (left.predictiveReorderQuantity ?? -1);
    if (quantityDifference !== 0) return quantityDifference;
  }

  const skuDifference = left.sku.localeCompare(right.sku);
  if (skuDifference !== 0) return skuDifference;

  const nameDifference = left.name.localeCompare(right.name);
  return nameDifference !== 0 ? nameDifference : left.productId.localeCompare(right.productId);
}

function selectLatestForecastsByProduct(forecasts: LatestForecastRun[]) {
  const latestByProductId = new Map<string, LatestForecastRun>();

  for (const forecast of forecasts) {
    if (!forecast.productId || latestByProductId.has(forecast.productId)) continue;
    latestByProductId.set(forecast.productId, forecast);
  }

  return latestByProductId;
}

async function getSalesDashboard(now = new Date()) {
  const todayKey = manilaDateKey(now);
  const tomorrowKey = addDays(todayKey, 1);
  const trendStartKey = addDays(todayKey, -(TREND_DAYS - 1));
  const monthStartKey = firstDayOfMonthKey(todayKey);
  const nextMonthStartKey = nextMonthKey(todayKey);
  const todayStart = manilaDayStartUtc(todayKey);
  const tomorrowStart = manilaDayStartUtc(tomorrowKey);
  const trendStart = manilaDayStartUtc(trendStartKey);
  const monthStart = manilaDayStartUtc(monthStartKey);
  const nextMonthStart = manilaDayStartUtc(nextMonthStartKey);
  const trendByDate = new Map<string, SalesTrendPoint>(
    dateRange(trendStartKey, todayKey).map((date) => [
      date,
      { date, revenueCents: 0, transactions: 0 },
    ]),
  );

  const [rollingSales, monthRevenue, todayUnits] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: SaleStatus.COMPLETED,
        soldAt: { gte: trendStart, lt: tomorrowStart },
      },
      select: {
        soldAt: true,
        grandTotalCents: true,
      },
    }),
    prisma.sale.aggregate({
      where: {
        status: SaleStatus.COMPLETED,
        soldAt: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { grandTotalCents: true },
    }),
    prisma.saleItem.aggregate({
      where: {
        sale: {
          status: SaleStatus.COMPLETED,
          soldAt: { gte: todayStart, lt: tomorrowStart },
        },
      },
      _sum: { quantity: true },
    }),
  ]);

  for (const sale of rollingSales) {
    const date = manilaDateKey(sale.soldAt);
    const point = trendByDate.get(date);
    if (!point) continue;

    point.revenueCents += sale.grandTotalCents;
    point.transactions += 1;
  }

  const todaySales = rollingSales.filter((sale) => {
    const soldAt = sale.soldAt.getTime();
    return soldAt >= todayStart.getTime() && soldAt < tomorrowStart.getTime();
  });
  const todayRevenueCents = sumCents(todaySales);
  const todayTransactions = todaySales.length;

  return {
    sales: {
      todayRevenueCents,
      todayTransactions,
      averageTransactionCents:
        todayTransactions > 0 ? Math.round(todayRevenueCents / todayTransactions) : 0,
      unitsSoldToday: decimalToNumber(todayUnits._sum.quantity),
      weekRevenueCents: sumCents(rollingSales),
      monthRevenueCents: monthRevenue._sum.grandTotalCents ?? 0,
    },
    salesTrend: [...trendByDate.values()],
  };
}

async function getInventoryDashboard() {
  const products = await prisma.product.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      name: true,
      unitType: true,
      reorderPoint: true,
      stockLevel: { select: { currentQuantity: true } },
    },
  });
  const lowStockProducts = [];
  const counts: Record<StockHealth, number> = {
    OUT_OF_STOCK: 0,
    CRITICAL: 0,
    LOW: 0,
    HEALTHY: 0,
    UNCONFIGURED: 0,
  };

  for (const product of products) {
    const serialized = serializeLowStockProduct(product);
    if (!serialized) {
      throw new Error('Inventory data is not ready');
    }

    counts[serialized.stockHealth] += 1;
    if (ATTENTION_STOCK_HEALTH.includes(serialized.stockHealth)) {
      lowStockProducts.push(serialized);
    }
  }

  return {
    inventory: {
      totalProducts: products.length,
      outOfStock: counts.OUT_OF_STOCK,
      critical: counts.CRITICAL,
      low: counts.LOW,
      healthy: counts.HEALTHY,
      unconfiguredReorderPoints: counts.UNCONFIGURED,
    },
    lowStockProducts: lowStockProducts
      .sort(stockHealthSort)
      .slice(0, LOW_STOCK_LIMIT),
  };
}

async function getPredictiveDashboard() {
  const products: PredictiveProduct[] = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    orderBy: [{ sku: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      name: true,
      stockLevel: { select: { currentQuantity: true } },
    },
  });

  if (!products.length) {
    return {
      predictive: {
        activeProducts: 0,
        outOfStock: 0,
        critical: 0,
        atRisk: 0,
        stable: 0,
        noDemand: 0,
        forecastRequired: 0,
        limitedHistory: 0,
        totalPredictiveReorderQuantity: 0,
        attentionProducts: [],
      },
    };
  }

  const productIds = products.map((product) => product.id);
  const forecastCandidates = await prisma.forecastRun.findMany({
    where: {
      scope: ForecastScope.PRODUCT,
      productId: { in: productIds },
      method: ForecastMethod.MOVING_AVERAGE,
      granularity: ForecastGranularity.DAILY,
    },
    orderBy: [{ productId: 'asc' }, { generatedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      productId: true,
      horizonPeriods: true,
      parameters: true,
      generatedAt: true,
    },
  });
  const latestByProductId = selectLatestForecastsByProduct(forecastCandidates);
  const latestRunsMissingAverage = [...latestByProductId.values()].filter((forecast) => {
    const parameters = readForecastInsightParameters(forecast.parameters);
    return parameters.averageDailyDemand === null;
  });
  const firstPointDemandByRunId = new Map<string, number>();

  if (latestRunsMissingAverage.length) {
    const forecastPoints = await prisma.forecastPoint.findMany({
      where: { forecastRunId: { in: latestRunsMissingAverage.map((forecast) => forecast.id) } },
      orderBy: [{ forecastRunId: 'asc' }, { periodStart: 'asc' }],
      select: {
        forecastRunId: true,
        predictedQuantity: true,
      },
    });

    for (const point of forecastPoints) {
      if (!firstPointDemandByRunId.has(point.forecastRunId)) {
        firstPointDemandByRunId.set(point.forecastRunId, decimalToNumber(point.predictedQuantity));
      }
    }
  }

  const counts: Record<ForecastRisk, number> = {
    OUT_OF_STOCK: 0,
    CRITICAL: 0,
    AT_RISK: 0,
    STABLE: 0,
    NO_DEMAND: 0,
    NO_FORECAST: 0,
  };
  const attentionProducts: PredictiveAttentionProduct[] = [];
  let limitedHistory = 0;
  let totalPredictiveReorderQuantity = 0;

  for (const product of products) {
    if (!product.stockLevel) {
      throw new Error('Inventory data is not ready');
    }

    const currentQuantity = product.stockLevel.currentQuantity;
    const latestForecast = latestByProductId.get(product.id);
    const parameters = latestForecast
      ? readForecastInsightParameters(latestForecast.parameters)
      : null;
    const averageDailyDemand = latestForecast
      ? parameters?.averageDailyDemand ?? firstPointDemandByRunId.get(latestForecast.id) ?? 0
      : null;
    const horizonDays = latestForecast
      ? parameters?.horizonDays ?? latestForecast.horizonPeriods
      : null;
    const daysOfStockRemaining = calculateDaysOfStockRemaining(
      currentQuantity,
      averageDailyDemand,
    );
    const forecastDemandForHorizon = calculateForecastDemandForHorizon(
      averageDailyDemand,
      horizonDays,
    );
    const predictiveReorderQuantity = calculatePredictiveReorderQuantity(
      forecastDemandForHorizon,
      currentQuantity,
    );
    const risk = classifyForecastRisk(currentQuantity, averageDailyDemand);

    counts[risk] += 1;
    if (parameters?.isLimitedHistory === true) {
      limitedHistory += 1;
    }
    if (predictiveReorderQuantity !== null) {
      totalPredictiveReorderQuantity += predictiveReorderQuantity;
    }

    if (PREDICTIVE_ATTENTION_RISKS.includes(risk)) {
      attentionProducts.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        currentQuantity,
        risk,
        averageDailyDemand,
        daysOfStockRemaining,
        estimatedStockoutDate: calculateEstimatedStockoutDate(daysOfStockRemaining),
        predictiveReorderQuantity,
        horizonDays,
        historyDaysUsed: parameters?.historyDaysUsed ?? null,
        isLimitedHistory: parameters?.isLimitedHistory ?? null,
      });
    }
  }

  return {
    predictive: {
      activeProducts: products.length,
      outOfStock: counts.OUT_OF_STOCK,
      critical: counts.CRITICAL,
      atRisk: counts.AT_RISK,
      stable: counts.STABLE,
      noDemand: counts.NO_DEMAND,
      forecastRequired: counts.NO_FORECAST,
      limitedHistory,
      totalPredictiveReorderQuantity,
      attentionProducts: attentionProducts
        .sort(predictiveAttentionSort)
        .slice(0, PREDICTIVE_ATTENTION_LIMIT),
    },
  };
}

async function getProcurementDashboard(now = new Date()) {
  const todayKey = manilaDateKey(now);
  const deliveryEndKey = addDays(todayKey, 8);
  const todayStart = manilaDayStartUtc(todayKey);
  const deliveryEnd = manilaDayStartUtc(deliveryEndKey);
  const [statusCounts, openValue, upcomingDeliveries] = await Promise.all([
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { status: { in: [...OPEN_PO_STATUSES] } },
      _sum: { subtotalCents: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        status: { in: [...OPEN_PO_STATUSES] },
        expectedDeliveryDate: { gte: todayStart, lt: deliveryEnd },
      },
      orderBy: [{ expectedDeliveryDate: 'asc' }, { id: 'asc' }],
      take: UPCOMING_DELIVERY_LIMIT,
      select: {
        id: true,
        poNumber: true,
        status: true,
        subtotalCents: true,
        expectedDeliveryDate: true,
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const countByStatus = new Map(
    statusCounts.map((entry) => [entry.status, entry._count._all]),
  );

  return {
    procurement: {
      openPurchaseOrders:
        (countByStatus.get(PurchaseOrderStatus.ORDERED) ?? 0) +
        (countByStatus.get(PurchaseOrderStatus.PARTIALLY_RECEIVED) ?? 0),
      draftPurchaseOrders: countByStatus.get(PurchaseOrderStatus.DRAFT) ?? 0,
      partiallyReceived: countByStatus.get(PurchaseOrderStatus.PARTIALLY_RECEIVED) ?? 0,
      // Phase 8B intentionally reports full subtotal for open POs, not remaining unreceived value.
      openPurchaseOrderValueCents: openValue._sum.subtotalCents ?? 0,
      upcomingDeliveries: upcomingDeliveries.map((purchaseOrder) => ({
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        supplier: purchaseOrder.supplier,
        status: purchaseOrder.status,
        subtotalCents: purchaseOrder.subtotalCents,
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
        itemCount: purchaseOrder._count.items,
      })),
    },
  };
}

async function getRecentActivityDashboard() {
  const events = await prisma.auditEvent.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: RECENT_ACTIVITY_LIMIT,
    select: {
      id: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityLabel: true,
      actorEmailSnapshot: true,
      metadata: true,
      actor: {
        select: {
          email: true,
          fullName: true,
          username: true,
        },
      },
    },
  });

  return {
    recentActivity: events.map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      actorDisplay: actorDisplay(event.actor, event.actorEmailSnapshot),
      operation: metadataOperation(event.metadata) ?? event.action,
      action: event.action,
      entityType: event.entityType,
      entityLabel: event.entityLabel,
    })),
  };
}

export async function getAdminDashboard(_request: Request, response: Response) {
  try {
    const [
      salesDashboard,
      inventoryDashboard,
      predictiveDashboard,
      procurementDashboard,
      recentActivityDashboard,
    ] = await Promise.all([
      getSalesDashboard(),
      getInventoryDashboard(),
      getPredictiveDashboard(),
      getProcurementDashboard(),
      getRecentActivityDashboard(),
    ]);

    response.json({
      sales: salesDashboard.sales,
      salesTrend: salesDashboard.salesTrend,
      inventory: inventoryDashboard.inventory,
      lowStockProducts: inventoryDashboard.lowStockProducts,
      predictive: predictiveDashboard.predictive,
      procurement: procurementDashboard.procurement,
      recentActivity: recentActivityDashboard.recentActivity,
    });
  } catch (error) {
    console.error('Loading admin dashboard failed:', error);
    response.status(500).json({ message: 'Unable to load dashboard' });
  }
}
