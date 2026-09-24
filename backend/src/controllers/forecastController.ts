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
  FORECAST_TIMEZONE,
  MOVING_AVERAGE_MODEL_VERSION,
  addDays,
  applySaleQuantity,
  compareDateKeys,
  createZeroFilledDailyDemand,
  dateKeyToDateOnly,
  dateRange,
  decimalToNumber,
  manilaDateKey,
  manilaDayStartUtc,
  maxDateKey,
  movingAverage,
} from '../utils/forecasting.js';
import {
  calculateDaysOfStockRemaining,
  calculateEstimatedStockoutDate,
  calculateForecastDemandForHorizon,
  calculatePredictiveReorderQuantity,
  classifyForecastRisk,
  readForecastInsightParameters,
} from '../utils/inventoryForecastInsights.js';
import {
  classifyStockHealth,
  recommendedReorderQuantity,
} from '../utils/inventoryHealth.js';
import {
  calculateForecastEvaluation,
  getMaturedForecastPoints,
} from '../utils/forecastEvaluation.js';

const ALLOWED_WINDOW_DAYS = [7, 14, 30] as const;
const ALLOWED_HORIZON_DAYS = [7, 14, 30] as const;
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_HORIZON_DAYS = 14;

type ForecastParameters = {
  windowDays: number;
  horizonDays: number;
  aggregation: 'DAILY';
  timezone: typeof FORECAST_TIMEZONE;
  historyDaysUsed?: number;
  isLimitedHistory?: boolean;
  averageDailyDemand?: number;
};

function getProductId(request: Request): string {
  const raw = request.params.productId;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

function readAllowedInteger(
  value: unknown,
  allowedValues: readonly number[],
  defaultValue: number,
) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: defaultValue };
  }

  if (typeof value === 'number' && Number.isInteger(value) && allowedValues.includes(value)) {
    return { ok: true as const, value };
  }

  return { ok: false as const };
}

function serializeProduct(product: { id: string; sku: string; name: string }) {
  return { id: product.id, sku: product.sku, name: product.name };
}

function productEntityLabel(product: { sku: string; name: string }) {
  return `${product.sku} - ${product.name}`;
}

function decimalToAuditString(value: Prisma.Decimal) {
  return value.toString();
}

function dateOnlyKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseParameters(value: Prisma.JsonValue): Partial<ForecastParameters> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const parameters = value as Record<string, unknown>;
  return {
    windowDays: typeof parameters.windowDays === 'number' ? parameters.windowDays : undefined,
    horizonDays: typeof parameters.horizonDays === 'number' ? parameters.horizonDays : undefined,
    aggregation: parameters.aggregation === 'DAILY' ? 'DAILY' : undefined,
    timezone: parameters.timezone === FORECAST_TIMEZONE ? FORECAST_TIMEZONE : undefined,
    historyDaysUsed:
      typeof parameters.historyDaysUsed === 'number' ? parameters.historyDaysUsed : undefined,
    isLimitedHistory:
      typeof parameters.isLimitedHistory === 'boolean' ? parameters.isLimitedHistory : undefined,
    averageDailyDemand:
      typeof parameters.averageDailyDemand === 'number' ? parameters.averageDailyDemand : undefined,
  };
}

function serializeForecastRun(run: {
  id: string;
  method: string;
  granularity: string;
  sourceStartDate: Date;
  sourceEndDate: Date;
  horizonStartDate: Date;
  horizonEndDate: Date;
  horizonPeriods: number;
  parameters: Prisma.JsonValue;
  status: string;
  version: number;
  generatedAt: Date;
  product: { id: string; sku: string; name: string } | null;
  points: Array<{
    periodStart: Date;
    predictedQuantity: Prisma.Decimal;
  }>;
}) {
  const parameters = parseParameters(run.parameters);
  const averageDailyDemand = parameters.averageDailyDemand
    ?? (run.points[0] ? decimalToNumber(run.points[0].predictedQuantity) : undefined);

  return {
    runId: run.id,
    product: run.product ? serializeProduct(run.product) : null,
    method: run.method,
    granularity: run.granularity,
    windowDays: parameters.windowDays,
    horizonDays: parameters.horizonDays ?? run.horizonPeriods,
    historyDaysUsed: parameters.historyDaysUsed,
    isLimitedHistory: parameters.isLimitedHistory,
    averageDailyDemand,
    sourceStartDate: dateOnlyKey(run.sourceStartDate),
    sourceEndDate: dateOnlyKey(run.sourceEndDate),
    horizonStartDate: dateOnlyKey(run.horizonStartDate),
    horizonEndDate: dateOnlyKey(run.horizonEndDate),
    status: run.status,
    version: run.version,
    generatedAt: run.generatedAt,
    points: run.points.map((point) => ({
      date: dateOnlyKey(point.periodStart),
      predictedQuantity: decimalToNumber(point.predictedQuantity),
    })),
  };
}

export async function generateProductForecast(request: Request, response: Response) {
  const productId = getProductId(request);
  const windowDays = readAllowedInteger(
    request.body?.windowDays,
    ALLOWED_WINDOW_DAYS,
    DEFAULT_WINDOW_DAYS,
  );
  if (!windowDays.ok) {
    response.status(400).json({ message: 'windowDays must be one of: 7, 14, 30' });
    return;
  }

  const horizonDays = readAllowedInteger(
    request.body?.horizonDays,
    ALLOWED_HORIZON_DAYS,
    DEFAULT_HORIZON_DAYS,
  );
  if (!horizonDays.ok) {
    response.status(400).json({ message: 'horizonDays must be one of: 7, 14, 30' });
    return;
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true, status: true, createdAt: true },
    });

    if (!product) {
      response.status(404).json({ message: 'Product not found' });
      return;
    }

    if (product.status !== 'ACTIVE') {
      response.status(409).json({
        message: 'Forecasts can only be generated for active products.',
      });
      return;
    }

    const today = manilaDateKey();
    const sourceEndKey = addDays(today, -1);
    const createdKey = manilaDateKey(product.createdAt);
    const requestedSourceStartKey = addDays(sourceEndKey, -(windowDays.value - 1));
    const sourceStartKey = maxDateKey(requestedSourceStartKey, createdKey);

    if (compareDateKeys(sourceStartKey, sourceEndKey) > 0) {
      response.json({
        forecastStatus: 'NO_HISTORY',
        message: 'Not enough historical sales data is available to generate a forecast.',
        product: serializeProduct(product),
      });
      return;
    }

    const dailyDemand = createZeroFilledDailyDemand(sourceStartKey, sourceEndKey);
    const saleItems = await prisma.saleItem.findMany({
      where: {
        productId,
        sale: {
          status: 'COMPLETED',
          soldAt: {
            gte: manilaDayStartUtc(sourceStartKey),
            lt: manilaDayStartUtc(addDays(sourceEndKey, 1)),
          },
        },
      },
      select: {
        quantity: true,
        sale: { select: { soldAt: true } },
      },
    });

    for (const saleItem of saleItems) {
      applySaleQuantity(dailyDemand, saleItem.sale.soldAt, saleItem.quantity);
    }

    const averageDailyDemand = movingAverage(dailyDemand);
    const averageDailyDemandNumber = decimalToNumber(averageDailyDemand);
    const historyDaysUsed = dailyDemand.length;
    const horizonStartKey = addDays(today, 1);
    const horizonEndKey = addDays(horizonStartKey, horizonDays.value - 1);
    const horizonKeys = dateRange(horizonStartKey, horizonEndKey);
    const parameters: ForecastParameters = {
      windowDays: windowDays.value,
      horizonDays: horizonDays.value,
      aggregation: 'DAILY',
      timezone: FORECAST_TIMEZONE,
      historyDaysUsed,
      isLimitedHistory: historyDaysUsed < windowDays.value,
      averageDailyDemand: averageDailyDemandNumber,
    };

    const forecast = await prisma.$transaction(async (transaction) => {
      const version = ((await transaction.forecastRun.aggregate({
        where: {
          scope: 'PRODUCT',
          targetKey: productId,
          productId,
          method: 'MOVING_AVERAGE',
          granularity: 'DAILY',
          sourceStartDate: dateKeyToDateOnly(sourceStartKey),
          sourceEndDate: dateKeyToDateOnly(sourceEndKey),
          horizonStartDate: dateKeyToDateOnly(horizonStartKey),
          horizonEndDate: dateKeyToDateOnly(horizonEndKey),
          horizonPeriods: horizonDays.value,
        },
        _max: { version: true },
      }))._max.version ?? 0) + 1;

      const createdForecast = await transaction.forecastRun.create({
        data: {
          scope: 'PRODUCT',
          targetKey: productId,
          productId,
          method: 'MOVING_AVERAGE',
          granularity: 'DAILY',
          sourceStartDate: dateKeyToDateOnly(sourceStartKey),
          sourceEndDate: dateKeyToDateOnly(sourceEndKey),
          horizonStartDate: dateKeyToDateOnly(horizonStartKey),
          horizonEndDate: dateKeyToDateOnly(horizonEndKey),
          horizonPeriods: horizonDays.value,
          parameters,
          status: 'DRAFT',
          version,
          modelVersion: MOVING_AVERAGE_MODEL_VERSION,
          generatedById: request.authUser?.id,
          points: {
            create: horizonKeys.map((date) => ({
              periodStart: dateKeyToDateOnly(date),
              periodEnd: dateKeyToDateOnly(date),
              predictedQuantity: averageDailyDemand,
            })),
          },
        },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          points: {
            orderBy: { periodStart: 'asc' },
            select: { periodStart: true, predictedQuantity: true },
          },
        },
      });

      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.DATA_CHANGE,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.FORECAST_RUN,
          entityId: createdForecast.id,
          entityLabel: productEntityLabel(product),
          actorUserId: request.authUser?.id ?? null,
          after: {
            method: createdForecast.method,
            granularity: createdForecast.granularity,
            status: createdForecast.status,
            version: createdForecast.version,
            forecastPointCount: createdForecast.points.length,
          },
          metadata: {
            operation: 'FORECAST_GENERATED',
            productId,
            method: createdForecast.method,
            granularity: createdForecast.granularity,
            windowDays: windowDays.value,
            horizonDays: horizonDays.value,
            historyDaysUsed,
            isLimitedHistory: historyDaysUsed < windowDays.value,
            averageDailyDemand: decimalToAuditString(averageDailyDemand),
            forecastPointCount: createdForecast.points.length,
          },
        },
        transaction,
      );

      return createdForecast;
    });

    response.status(201).json({ forecast: serializeForecastRun(forecast) });
  } catch (error) {
    logError('Generating product forecast failed', error);
    response.status(500).json({ message: 'Unable to generate forecast' });
  }
}

export async function getLatestProductForecast(request: Request, response: Response) {
  const productId = getProductId(request);

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      response.status(404).json({ message: 'Product not found' });
      return;
    }

    const forecast = await prisma.forecastRun.findFirst({
      where: {
        scope: 'PRODUCT',
        productId,
        method: 'MOVING_AVERAGE',
        granularity: 'DAILY',
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      include: {
        product: { select: { id: true, sku: true, name: true } },
        points: {
          orderBy: { periodStart: 'asc' },
          select: { periodStart: true, predictedQuantity: true },
        },
      },
    });

    if (!forecast) {
      response.status(404).json({
        message: 'No forecast has been generated for this product yet.',
      });
      return;
    }

    response.json({ forecast: serializeForecastRun(forecast) });
  } catch (error) {
    logError('Loading latest product forecast failed', error);
    response.status(500).json({ message: 'Unable to load forecast' });
  }
}

export async function getLatestProductForecastEvaluation(request: Request, response: Response) {
  const productId = getProductId(request);

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });

    if (!product) {
      response.status(404).json({ message: 'Product not found' });
      return;
    }

    const forecast = await prisma.forecastRun.findFirst({
      where: {
        scope: 'PRODUCT',
        productId,
        method: 'MOVING_AVERAGE',
        granularity: 'DAILY',
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      include: {
        points: {
          orderBy: { periodStart: 'asc' },
          select: { periodStart: true, predictedQuantity: true },
        },
      },
    });

    if (!forecast) {
      response.status(404).json({
        message: 'No forecast has been generated for this product yet.',
      });
      return;
    }

    const parameters = readForecastInsightParameters(forecast.parameters);
    const currentManilaDateKey = manilaDateKey();
    const forecastPoints = forecast.points.map((point) => ({
      date: dateOnlyKey(point.periodStart),
      predictedQuantity: point.predictedQuantity,
    }));
    const maturedPoints = getMaturedForecastPoints(forecastPoints, currentManilaDateKey);

    const actualDemandByDate = new Map<string, Prisma.Decimal>();
    if (maturedPoints.length) {
      const firstDate = maturedPoints[0]?.date;
      const lastDate = maturedPoints[maturedPoints.length - 1]?.date;

      if (firstDate && lastDate) {
        const saleItems = await prisma.saleItem.findMany({
          where: {
            productId,
            sale: {
              status: 'COMPLETED',
              soldAt: {
                gte: manilaDayStartUtc(firstDate),
                lt: manilaDayStartUtc(addDays(lastDate, 1)),
              },
            },
          },
          select: {
            quantity: true,
            sale: { select: { soldAt: true } },
          },
        });

        for (const saleItem of saleItems) {
          const date = manilaDateKey(saleItem.sale.soldAt);
          actualDemandByDate.set(
            date,
            (actualDemandByDate.get(date) ?? new Prisma.Decimal(0)).plus(saleItem.quantity),
          );
        }
      }
    }

    const evaluation = calculateForecastEvaluation(
      maturedPoints,
      forecastPoints.length,
      actualDemandByDate,
    );

    response.json({
      status: evaluation.status,
      product: serializeProduct(product),
      forecastRun: {
        id: forecast.id,
        generatedAt: forecast.generatedAt,
        windowDays: parameters.windowDays,
        horizonDays: parameters.horizonDays ?? forecast.horizonPeriods,
        historyDaysUsed: parameters.historyDaysUsed,
        isLimitedHistory: parameters.isLimitedHistory,
      },
      evaluatedPeriods: evaluation.evaluatedPeriods,
      totalForecastPeriods: evaluation.totalForecastPeriods,
      coveragePercent: evaluation.coveragePercent,
      metrics: evaluation.metrics,
      points: evaluation.points,
    });
  } catch (error) {
    logError('Loading latest product forecast evaluation failed', error);
    response.status(500).json({ message: 'Unable to load forecast evaluation' });
  }
}

export async function getProductForecastInsights(request: Request, response: Response) {
  const productId = getProductId(request);

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        sku: true,
        name: true,
        status: true,
        reorderPoint: true,
        stockLevel: { select: { currentQuantity: true } },
      },
    });

    if (!product) {
      response.status(404).json({ message: 'Product not found' });
      return;
    }

    if (product.status !== 'ACTIVE') {
      response.status(409).json({
        message: 'Forecasts can only be generated for active products.',
      });
      return;
    }

    if (!product.stockLevel) {
      response.status(500).json({ message: 'Inventory data is not ready' });
      return;
    }

    const currentQuantity = product.stockLevel.currentQuantity;
    const stockHealth = classifyStockHealth(currentQuantity, product.reorderPoint);
    const staticRecommendedReorderQuantity = recommendedReorderQuantity(
      currentQuantity,
      product.reorderPoint,
    );
    const latestForecast = await prisma.forecastRun.findFirst({
      where: {
        scope: 'PRODUCT',
        productId,
        method: 'MOVING_AVERAGE',
        granularity: 'DAILY',
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      include: {
        points: {
          orderBy: { periodStart: 'asc' },
          select: { predictedQuantity: true },
        },
      },
    });

    if (!latestForecast) {
      response.json({
        insight: {
          product: serializeProduct(product),
          inventory: {
            currentQuantity,
            reorderPoint: product.reorderPoint,
            stockHealth,
            staticRecommendedReorderQuantity,
          },
          forecast: null,
          predictive: {
            daysOfStockRemaining: null,
            estimatedStockoutDate: null,
            forecastDemandForHorizon: null,
            predictiveReorderQuantity: null,
            risk: 'NO_FORECAST',
          },
        },
      });
      return;
    }

    const parameters = readForecastInsightParameters(latestForecast.parameters);
    const averageDailyDemand = parameters.averageDailyDemand
      ?? (latestForecast.points[0] ? decimalToNumber(latestForecast.points[0].predictedQuantity) : 0);
    const horizonDays = parameters.horizonDays ?? latestForecast.horizonPeriods;
    const daysOfStockRemaining = calculateDaysOfStockRemaining(
      currentQuantity,
      averageDailyDemand,
    );
    const forecastDemandForHorizon = calculateForecastDemandForHorizon(
      averageDailyDemand,
      horizonDays,
    );

    response.json({
      insight: {
        product: serializeProduct(product),
        inventory: {
          currentQuantity,
          reorderPoint: product.reorderPoint,
          stockHealth,
          staticRecommendedReorderQuantity,
        },
        forecast: {
          runId: latestForecast.id,
          method: latestForecast.method,
          windowDays: parameters.windowDays,
          horizonDays,
          historyDaysUsed: parameters.historyDaysUsed,
          isLimitedHistory: parameters.isLimitedHistory,
          averageDailyDemand,
        },
        predictive: {
          daysOfStockRemaining,
          estimatedStockoutDate: calculateEstimatedStockoutDate(daysOfStockRemaining),
          forecastDemandForHorizon,
          predictiveReorderQuantity: calculatePredictiveReorderQuantity(
            forecastDemandForHorizon,
            currentQuantity,
          ),
          risk: classifyForecastRisk(currentQuantity, averageDailyDemand),
        },
      },
    });
  } catch (error) {
    logError('Loading product forecast insights failed', error);
    response.status(500).json({ message: 'Unable to load forecast insights' });
  }
}
