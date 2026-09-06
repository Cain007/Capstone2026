import { Prisma } from '@prisma/client';
import { compareDateKeys } from './forecasting.js';

export type ForecastBiasDirection = 'OVER_FORECAST' | 'UNDER_FORECAST' | 'BALANCED';

export type ForecastEvaluationStatus = 'READY' | 'NOT_READY';

export type ForecastEvaluationInputPoint = {
  date: string;
  predictedQuantity: Prisma.Decimal;
};

export type ForecastEvaluationRow = {
  date: string;
  predictedQuantity: number;
  actualQuantity: number;
  error: number;
  absoluteError: number;
};

export type ForecastEvaluationMetrics = {
  totalPredicted: number;
  totalActual: number;
  mae: number;
  wapePercent: number | null;
  meanError: number;
  biasDirection: ForecastBiasDirection;
};

export type ForecastEvaluationResult = {
  status: ForecastEvaluationStatus;
  evaluatedPeriods: number;
  totalForecastPeriods: number;
  coveragePercent: number;
  metrics: ForecastEvaluationMetrics | null;
  points: ForecastEvaluationRow[];
};

function decimalToFixedNumber(value: Prisma.Decimal, decimalPlaces: number) {
  return value.toDecimalPlaces(decimalPlaces).toNumber();
}

function percentageToNumber(value: Prisma.Decimal) {
  return decimalToFixedNumber(value, 2);
}

export function getMaturedForecastPoints(
  points: ForecastEvaluationInputPoint[],
  currentManilaDateKey: string,
) {
  return points.filter((point) => compareDateKeys(point.date, currentManilaDateKey) < 0);
}

export function classifyForecastBias(meanError: Prisma.Decimal): ForecastBiasDirection {
  if (meanError.gt(0)) return 'OVER_FORECAST';
  if (meanError.lt(0)) return 'UNDER_FORECAST';
  return 'BALANCED';
}

export function calculateForecastEvaluation(
  maturedPoints: ForecastEvaluationInputPoint[],
  totalForecastPeriods: number,
  actualDemandByDate: Map<string, Prisma.Decimal>,
): ForecastEvaluationResult {
  const evaluatedPeriods = maturedPoints.length;
  const coveragePercent = totalForecastPeriods
    ? percentageToNumber(new Prisma.Decimal(evaluatedPeriods).div(totalForecastPeriods).times(100))
    : 0;

  if (!evaluatedPeriods) {
    return {
      status: 'NOT_READY',
      evaluatedPeriods,
      totalForecastPeriods,
      coveragePercent,
      metrics: null,
      points: [],
    };
  }

  let totalPredicted = new Prisma.Decimal(0);
  let totalActual = new Prisma.Decimal(0);
  let totalError = new Prisma.Decimal(0);
  let totalAbsoluteError = new Prisma.Decimal(0);

  const points = maturedPoints.map((point) => {
    const actualQuantity = actualDemandByDate.get(point.date) ?? new Prisma.Decimal(0);
    const error = point.predictedQuantity.minus(actualQuantity);
    const absoluteError = error.abs();

    totalPredicted = totalPredicted.plus(point.predictedQuantity);
    totalActual = totalActual.plus(actualQuantity);
    totalError = totalError.plus(error);
    totalAbsoluteError = totalAbsoluteError.plus(absoluteError);

    return {
      date: point.date,
      predictedQuantity: decimalToFixedNumber(point.predictedQuantity, 4),
      actualQuantity: decimalToFixedNumber(actualQuantity, 4),
      error: decimalToFixedNumber(error, 4),
      absoluteError: decimalToFixedNumber(absoluteError, 4),
    };
  });

  const divisor = new Prisma.Decimal(evaluatedPeriods);
  const mae = totalAbsoluteError.div(divisor);
  const meanError = totalError.div(divisor);

  return {
    status: 'READY',
    evaluatedPeriods,
    totalForecastPeriods,
    coveragePercent,
    metrics: {
      totalPredicted: decimalToFixedNumber(totalPredicted, 4),
      totalActual: decimalToFixedNumber(totalActual, 4),
      mae: decimalToFixedNumber(mae, 4),
      wapePercent: totalActual.eq(0)
        ? null
        : percentageToNumber(totalAbsoluteError.div(totalActual).times(100)),
      meanError: decimalToFixedNumber(meanError, 4),
      biasDirection: classifyForecastBias(meanError),
    },
    points,
  };
}
