import { Prisma } from '@prisma/client';

export const FORECAST_TIMEZONE = 'Asia/Manila';
export const MOVING_AVERAGE_MODEL_VERSION = 'moving-average-v1';

const manilaDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: FORECAST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type DailyDemand = {
  date: string;
  quantity: Prisma.Decimal;
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

export function manilaDateKey(date = new Date()): string {
  const parts = manilaDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to resolve Philippine business date');
  }

  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function dateKeyToDateOnly(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day));
}

export function manilaDayStartUtc(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, -8));
}

export function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function maxDateKey(left: string, right: string): string {
  return compareDateKeys(left, right) >= 0 ? left : right;
}

export function dateRange(startKey: string, endKey: string): string[] {
  if (compareDateKeys(startKey, endKey) > 0) {
    return [];
  }

  const dates: string[] = [];
  for (let cursor = startKey; compareDateKeys(cursor, endKey) <= 0; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function createZeroFilledDailyDemand(startKey: string, endKey: string): DailyDemand[] {
  return dateRange(startKey, endKey).map((date) => ({
    date,
    quantity: new Prisma.Decimal(0),
  }));
}

export function applySaleQuantity(
  dailyDemand: DailyDemand[],
  soldAt: Date,
  quantity: Prisma.Decimal,
) {
  const date = manilaDateKey(soldAt);
  const demand = dailyDemand.find((item) => item.date === date);
  if (demand) {
    demand.quantity = demand.quantity.plus(quantity);
  }
}

export function movingAverage(dailyDemand: DailyDemand[]): Prisma.Decimal {
  if (!dailyDemand.length) {
    return new Prisma.Decimal(0);
  }

  const total = dailyDemand.reduce(
    (sum, item) => sum.plus(item.quantity),
    new Prisma.Decimal(0),
  );

  return total.div(dailyDemand.length).toDecimalPlaces(4);
}

export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}
