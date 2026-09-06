import { Prisma } from '@prisma/client';
import { FORECAST_TIMEZONE, addDays, manilaDateKey } from './forecasting.js';

export type ForecastRisk =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'AT_RISK'
  | 'STABLE'
  | 'NO_DEMAND'
  | 'NO_FORECAST';

export function roundInsightDecimal(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ForecastInsightParameters = {
  windowDays: number | null;
  horizonDays: number | null;
  historyDaysUsed: number | null;
  isLimitedHistory: boolean | null;
  averageDailyDemand: number | null;
};

export function readForecastInsightParameters(
  value: Prisma.JsonValue,
): ForecastInsightParameters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      windowDays: null,
      horizonDays: null,
      historyDaysUsed: null,
      isLimitedHistory: null,
      averageDailyDemand: null,
    };
  }

  const parameters = value as Record<string, unknown>;
  return {
    windowDays: typeof parameters.windowDays === 'number' ? parameters.windowDays : null,
    horizonDays: typeof parameters.horizonDays === 'number' ? parameters.horizonDays : null,
    historyDaysUsed:
      typeof parameters.historyDaysUsed === 'number' ? parameters.historyDaysUsed : null,
    isLimitedHistory:
      typeof parameters.isLimitedHistory === 'boolean' ? parameters.isLimitedHistory : null,
    averageDailyDemand:
      typeof parameters.averageDailyDemand === 'number' ? parameters.averageDailyDemand : null,
  };
}

export function hasDailyManilaForecastParameters(value: Prisma.JsonValue): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const parameters = value as Record<string, unknown>;
  return parameters.aggregation === 'DAILY' && parameters.timezone === FORECAST_TIMEZONE;
}

export function calculateDaysOfStockRemaining(
  currentQuantity: number,
  averageDailyDemand: number | null,
): number | null {
  if (currentQuantity === 0) {
    return 0;
  }

  if (averageDailyDemand === null || averageDailyDemand === 0) {
    return null;
  }

  return roundInsightDecimal(currentQuantity / averageDailyDemand);
}

export function calculateEstimatedStockoutDate(
  daysOfStockRemaining: number | null,
  currentDate = manilaDateKey(),
): string | null {
  if (daysOfStockRemaining === null) {
    return null;
  }

  if (daysOfStockRemaining === 0) {
    return currentDate;
  }

  return addDays(currentDate, Math.ceil(daysOfStockRemaining));
}

export function classifyForecastRisk(
  currentQuantity: number,
  averageDailyDemand: number | null,
): ForecastRisk {
  if (currentQuantity === 0) {
    return 'OUT_OF_STOCK';
  }

  if (averageDailyDemand === null) {
    return 'NO_FORECAST';
  }

  if (averageDailyDemand === 0) {
    return 'NO_DEMAND';
  }

  const daysOfStockRemaining = currentQuantity / averageDailyDemand;
  if (daysOfStockRemaining <= 3) {
    return 'CRITICAL';
  }

  if (daysOfStockRemaining <= 7) {
    return 'AT_RISK';
  }

  return 'STABLE';
}

export function calculateForecastDemandForHorizon(
  averageDailyDemand: number | null,
  horizonDays: number | null,
): number | null {
  if (averageDailyDemand === null || horizonDays === null) {
    return null;
  }

  return roundInsightDecimal(averageDailyDemand * horizonDays);
}

export function calculatePredictiveReorderQuantity(
  forecastDemandForHorizon: number | null,
  currentQuantity: number,
): number | null {
  if (forecastDemandForHorizon === null) {
    return null;
  }

  return Math.max(Math.ceil(forecastDemandForHorizon - currentQuantity), 0);
}
