import {
  ForecastGranularity,
  ForecastMethod,
  ForecastScope,
  Prisma,
  ProductStatus,
  SaleStatus,
} from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logError } from '../utils/safeLogger.js';
import {
  FORECAST_TIMEZONE,
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
  readForecastInsightParameters,
  type ForecastRisk,
} from '../utils/inventoryForecastInsights.js';
import {
  classifyStockHealth,
  recommendedReorderQuantity,
  type StockHealth,
} from '../utils/inventoryHealth.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_DAYS = 365;
const TOP_PRODUCT_LIMIT = 10;
const INVENTORY_ATTENTION_LIMIT = 20;
const FORECAST_ATTENTION_LIMIT = 10;
const STOCK_HEALTH_PRIORITY = new Map<StockHealth, number>([
  ['OUT_OF_STOCK', 0],
  ['CRITICAL', 1],
  ['LOW', 2],
  ['UNCONFIGURED', 3],
  ['HEALTHY', 4],
]);
const FORECAST_RISK_PRIORITY = new Map<ForecastRisk, number>([
  ['OUT_OF_STOCK', 0],
  ['CRITICAL', 1],
  ['AT_RISK', 2],
  ['NO_FORECAST', 3],
  ['NO_DEMAND', 4],
  ['STABLE', 5],
]);
const FORECAST_ATTENTION_RISKS: ForecastRisk[] = [
  'OUT_OF_STOCK',
  'CRITICAL',
  'AT_RISK',
  'NO_FORECAST',
];

type ReportRange = {
  fromKey: string;
  toKey: string;
  start: Date;
  end: Date;
  dates: string[];
};

type InventoryAttentionRow = {
  productId: string;
  sku: string;
  name: string;
  currentQuantity: number;
  reorderPoint: number | null;
  stockHealth: StockHealth;
  recommendedReorderQuantity: number | null;
};

type ForecastAttentionRow = {
  productId: string;
  sku: string;
  name: string;
  risk: ForecastRisk;
  averageDailyDemand: number | null;
  daysOfStockRemaining: number | null;
  estimatedStockoutDate: string | null;
  predictiveReorderQuantity: number | null;
  historyDaysUsed: number | null;
  isLimitedHistory: boolean | null;
};

function readDateKey(value: unknown, fallback: string) {
  if (value === undefined) return { ok: true as const, value: fallback };
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    return { ok: false as const, message: 'Report dates must use YYYY-MM-DD format' };
  }

  const date = manilaDayStartUtc(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false as const, message: 'Report dates must be valid calendar dates' };
  }

  return { ok: true as const, value };
}

function readReportRange(request: Request): { ok: true; value: ReportRange } | { ok: false; message: string } {
  const todayKey = manilaDateKey();
  const defaultFromKey = addDays(todayKey, -29);
  const from = readDateKey(request.query.from, defaultFromKey);
  if (!from.ok) return from;

  const to = readDateKey(request.query.to, todayKey);
  if (!to.ok) return to;

  if (from.value > to.value) {
    return { ok: false, message: 'from must be on or before to' };
  }

  const dates = dateRange(from.value, to.value);
  if (dates.length > MAX_REPORT_DAYS) {
    return { ok: false, message: `Report range cannot exceed ${MAX_REPORT_DAYS} days` };
  }

  return {
    ok: true,
    value: {
      fromKey: from.value,
      toKey: to.value,
      start: manilaDayStartUtc(from.value),
      end: manilaDayStartUtc(addDays(to.value, 1)),
      dates,
    },
  };
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) return 0;
  return Number(value.toString());
}

function stockHealthSort(left: InventoryAttentionRow, right: InventoryAttentionRow) {
  const priorityDifference =
    (STOCK_HEALTH_PRIORITY.get(left.stockHealth) ?? 99) -
    (STOCK_HEALTH_PRIORITY.get(right.stockHealth) ?? 99);
  if (priorityDifference !== 0) return priorityDifference;
  if (left.currentQuantity !== right.currentQuantity) return left.currentQuantity - right.currentQuantity;
  const nameDifference = left.name.localeCompare(right.name);
  return nameDifference !== 0 ? nameDifference : left.productId.localeCompare(right.productId);
}

function forecastAttentionSort(left: ForecastAttentionRow, right: ForecastAttentionRow) {
  const priorityDifference =
    (FORECAST_RISK_PRIORITY.get(left.risk) ?? 99) -
    (FORECAST_RISK_PRIORITY.get(right.risk) ?? 99);
  if (priorityDifference !== 0) return priorityDifference;

  if (left.risk === 'CRITICAL' || left.risk === 'AT_RISK') {
    const leftDays = left.daysOfStockRemaining ?? Number.POSITIVE_INFINITY;
    const rightDays = right.daysOfStockRemaining ?? Number.POSITIVE_INFINITY;
    if (leftDays !== rightDays) return leftDays - rightDays;
  }

  const nameDifference = left.name.localeCompare(right.name);
  return nameDifference !== 0 ? nameDifference : left.productId.localeCompare(right.productId);
}

async function getSalesReport(range: ReportRange) {
  const trendByDate = new Map(
    range.dates.map((date) => [
      date,
      { date, revenueCents: 0, transactions: 0, unitsSold: 0 },
    ]),
  );
  const sales = await prisma.sale.findMany({
    where: {
      status: SaleStatus.COMPLETED,
      soldAt: { gte: range.start, lt: range.end },
    },
    select: {
      id: true,
      soldAt: true,
      grandTotalCents: true,
      discountCents: true,
      taxCents: true,
      items: {
        select: {
          productId: true,
          productNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          lineTotalCents: true,
        },
      },
    },
  });
  const topProductsById = new Map<
    string,
    { productId: string; sku: string; name: string; quantitySold: number; revenueCents: number }
  >();
  let unitsSold = 0;

  for (const sale of sales) {
    const date = manilaDateKey(sale.soldAt);
    const trend = trendByDate.get(date);
    if (trend) {
      trend.revenueCents += sale.grandTotalCents;
      trend.transactions += 1;
    }

    for (const item of sale.items) {
      const quantity = decimalToNumber(item.quantity);
      unitsSold += quantity;
      if (trend) trend.unitsSold += quantity;

      const existing = topProductsById.get(item.productId) ?? {
        productId: item.productId,
        sku: item.skuSnapshot,
        name: item.productNameSnapshot,
        quantitySold: 0,
        revenueCents: 0,
      };
      existing.quantitySold += quantity;
      existing.revenueCents += item.lineTotalCents;
      topProductsById.set(item.productId, existing);
    }
  }

  const revenueCents = sales.reduce((sum, sale) => sum + sale.grandTotalCents, 0);
  const transactions = sales.length;

  return {
    sales: {
      revenueCents,
      transactions,
      unitsSold,
      averageTransactionCents: transactions ? Math.round(revenueCents / transactions) : 0,
      discountsCents: sales.reduce((sum, sale) => sum + sale.discountCents, 0),
      taxCents: sales.reduce((sum, sale) => sum + sale.taxCents, 0),
    },
    salesTrend: [...trendByDate.values()],
    topProducts: [...topProductsById.values()]
      .sort((left, right) => {
        if (right.quantitySold !== left.quantitySold) return right.quantitySold - left.quantitySold;
        if (right.revenueCents !== left.revenueCents) return right.revenueCents - left.revenueCents;
        return left.name.localeCompare(right.name);
      })
      .slice(0, TOP_PRODUCT_LIMIT),
  };
}

async function getInventoryReport() {
  const products = await prisma.product.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      name: true,
      reorderPoint: true,
      stockLevel: { select: { currentQuantity: true } },
    },
  });
  const counts: Record<StockHealth, number> = {
    OUT_OF_STOCK: 0,
    CRITICAL: 0,
    LOW: 0,
    HEALTHY: 0,
    UNCONFIGURED: 0,
  };
  const attention: InventoryAttentionRow[] = [];

  for (const product of products) {
    if (!product.stockLevel) throw new Error('Inventory data is not ready');

    const currentQuantity = product.stockLevel.currentQuantity;
    const stockHealth = classifyStockHealth(currentQuantity, product.reorderPoint);
    const row = {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      currentQuantity,
      reorderPoint: product.reorderPoint,
      stockHealth,
      recommendedReorderQuantity: recommendedReorderQuantity(currentQuantity, product.reorderPoint),
    };

    counts[stockHealth] += 1;
    if (stockHealth !== 'HEALTHY') attention.push(row);
  }

  return {
    inventory: {
      totalProducts: products.length,
      outOfStock: counts.OUT_OF_STOCK,
      critical: counts.CRITICAL,
      low: counts.LOW,
      healthy: counts.HEALTHY,
      unconfigured: counts.UNCONFIGURED,
    },
    inventoryAttention: attention
      .sort(stockHealthSort)
      .slice(0, INVENTORY_ATTENTION_LIMIT),
  };
}

async function getForecastReport() {
  const products = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    orderBy: [{ sku: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      name: true,
      stockLevel: { select: { currentQuantity: true } },
    },
  });
  const counts: Record<ForecastRisk, number> = {
    OUT_OF_STOCK: 0,
    CRITICAL: 0,
    AT_RISK: 0,
    STABLE: 0,
    NO_DEMAND: 0,
    NO_FORECAST: 0,
  };
  const productIds = products.map((product) => product.id);
  const forecastCandidates = productIds.length
    ? await prisma.forecastRun.findMany({
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
        },
      })
    : [];
  const latestByProductId = new Map<string, (typeof forecastCandidates)[number]>();

  for (const forecast of forecastCandidates) {
    if (forecast.productId && !latestByProductId.has(forecast.productId)) {
      latestByProductId.set(forecast.productId, forecast);
    }
  }

  const missingAverageRuns = [...latestByProductId.values()].filter(
    (forecast) => readForecastInsightParameters(forecast.parameters).averageDailyDemand === null,
  );
  const firstPointDemandByRunId = new Map<string, number>();

  if (missingAverageRuns.length) {
    const points = await prisma.forecastPoint.findMany({
      where: { forecastRunId: { in: missingAverageRuns.map((forecast) => forecast.id) } },
      orderBy: [{ forecastRunId: 'asc' }, { periodStart: 'asc' }],
      select: { forecastRunId: true, predictedQuantity: true },
    });

    for (const point of points) {
      if (!firstPointDemandByRunId.has(point.forecastRunId)) {
        firstPointDemandByRunId.set(point.forecastRunId, decimalToNumber(point.predictedQuantity));
      }
    }
  }

  const attention: ForecastAttentionRow[] = [];
  let limitedHistory = 0;
  let totalPredictiveReorderQuantity = 0;

  for (const product of products) {
    if (!product.stockLevel) throw new Error('Inventory data is not ready');

    const currentQuantity = product.stockLevel.currentQuantity;
    const forecast = latestByProductId.get(product.id);
    const parameters = forecast ? readForecastInsightParameters(forecast.parameters) : null;
    const averageDailyDemand = forecast
      ? parameters?.averageDailyDemand ?? firstPointDemandByRunId.get(forecast.id) ?? 0
      : null;
    const horizonDays = forecast ? parameters?.horizonDays ?? forecast.horizonPeriods : null;
    const daysOfStockRemaining = calculateDaysOfStockRemaining(currentQuantity, averageDailyDemand);
    const horizonDemand = calculateForecastDemandForHorizon(averageDailyDemand, horizonDays);
    const predictiveReorderQuantity = calculatePredictiveReorderQuantity(horizonDemand, currentQuantity);
    const risk = classifyForecastRisk(currentQuantity, averageDailyDemand);

    counts[risk] += 1;
    if (parameters?.isLimitedHistory === true) limitedHistory += 1;
    if (predictiveReorderQuantity !== null) totalPredictiveReorderQuantity += predictiveReorderQuantity;

    if (FORECAST_ATTENTION_RISKS.includes(risk)) {
      attention.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        risk,
        averageDailyDemand,
        daysOfStockRemaining,
        estimatedStockoutDate: calculateEstimatedStockoutDate(daysOfStockRemaining),
        predictiveReorderQuantity,
        historyDaysUsed: parameters?.historyDaysUsed ?? null,
        isLimitedHistory: parameters?.isLimitedHistory ?? null,
      });
    }
  }

  return {
    forecast: {
      activeProducts: products.length,
      productsWithForecast: latestByProductId.size,
      forecastRequired: counts.NO_FORECAST,
      critical: counts.CRITICAL,
      atRisk: counts.AT_RISK,
      stable: counts.STABLE,
      noDemand: counts.NO_DEMAND,
      limitedHistory,
      totalPredictiveReorderQuantity,
    },
    forecastAttention: attention
      .sort(forecastAttentionSort)
      .slice(0, FORECAST_ATTENTION_LIMIT),
  };
}

export async function getReportSummary(request: Request, response: Response) {
  const range = readReportRange(request);
  if (!range.ok) {
    response.status(400).json({ message: range.message });
    return;
  }

  try {
    const [salesReport, inventoryReport, forecastReport] = await Promise.all([
      getSalesReport(range.value),
      getInventoryReport(),
      getForecastReport(),
    ]);

    response.json({
      period: {
        from: range.value.fromKey,
        to: range.value.toKey,
        timezone: FORECAST_TIMEZONE,
      },
      sales: salesReport.sales,
      salesTrend: salesReport.salesTrend,
      topProducts: salesReport.topProducts,
      inventory: inventoryReport.inventory,
      inventoryAttention: inventoryReport.inventoryAttention,
      forecast: forecastReport.forecast,
      forecastAttention: forecastReport.forecastAttention,
    });
  } catch (error) {
    logError('Loading report summary failed', error);
    response.status(500).json({ message: 'Unable to load report summary' });
  }
}
