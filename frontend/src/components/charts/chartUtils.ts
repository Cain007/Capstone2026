import { max, scaleLinear, scalePoint } from 'd3';
import type { ScaleLinear } from 'd3';
import type { ChartDimensions, ChartInnerDimensions, ChartMargin } from './chartTypes';

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const compactDateFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
});

export function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(Math.max(value, minValue), maxValue);
}

export function formatPhpFromCents(cents: number) {
  return phpFormatter.format(cents / 100);
}

export function formatCompactPhpFromCents(cents: number) {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) return `PHP ${(pesos / 1_000_000).toLocaleString('en-PH', { maximumFractionDigits: 1 })}M`;
  if (pesos >= 1_000) return `PHP ${(pesos / 1_000).toLocaleString('en-PH', { maximumFractionDigits: 1 })}K`;
  return `PHP ${pesos.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function formatQuantity(value: number, options: { suffix?: string } = {}) {
  const formatted = value.toLocaleString('en-PH', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 0,
    maximumFractionDigits: 2,
  });

  return `${formatted}${options.suffix ?? ''}`;
}

export function formatBusinessDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? dateKey : compactDateFormatter.format(date);
}

export function createChartInnerDimensions(
  dimensions: ChartDimensions,
  margin: ChartMargin,
): ChartInnerDimensions {
  return {
    ...dimensions,
    margin,
    innerWidth: Math.max(0, dimensions.width - margin.left - margin.right),
    innerHeight: Math.max(0, dimensions.height - margin.top - margin.bottom),
  };
}

export function createTooltipPosition(
  x: number,
  y: number,
  bounds: ChartDimensions,
  options: { width?: number; height?: number; offsetX?: number; offsetY?: number } = {},
) {
  const tooltipWidth = options.width ?? 220;
  const tooltipHeight = options.height ?? 112;
  const offsetX = options.offsetX ?? 12;
  const offsetY = options.offsetY ?? 88;

  return {
    x: clamp(x + offsetX, 8, Math.max(8, bounds.width - tooltipWidth)),
    y: clamp(y - offsetY, 8, Math.max(8, bounds.height - tooltipHeight)),
  };
}

export function getDateLabelStep(pointCount: number, width: number) {
  const targetLabels = width < 420 ? 3 : width < 640 ? 5 : width < 900 ? 7 : 10;
  if (pointCount <= targetLabels) return 1;
  return Math.max(1, Math.ceil(pointCount / targetLabels));
}

export function getLinearTickValues(
  scale: ScaleLinear<number, number>,
  desiredTickCount = 4,
  options: { integerOnly?: boolean; includeUpperBound?: number } = {},
) {
  const rawTicks = scale.ticks(desiredTickCount);
  const ticks = options.integerOnly
    ? rawTicks.filter((tick) => Number.isInteger(tick))
    : rawTicks;
  const requiredTicks = [0];
  if (options.includeUpperBound !== undefined) {
    requiredTicks.push(options.includeUpperBound > 0 ? options.includeUpperBound : 1);
  }

  return Array.from(new Set([...ticks, ...requiredTicks]))
    .filter((tick) => tick >= 0)
    .sort((a, b) => a - b);
}

export function createLinearValueScale(values: number[], range: [number, number]) {
  const upperBound = max(values) ?? 0;
  return scaleLinear()
    .domain([0, upperBound > 0 ? upperBound : 1])
    .range(range)
    .nice();
}

export function createBusinessDatePointScale(dateKeys: string[], range: [number, number]) {
  return scalePoint<string>()
    .domain(dateKeys)
    .range(range)
    .padding(dateKeys.length > 1 ? 0.4 : 0.5);
}
