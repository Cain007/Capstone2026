import { line, max, scaleLinear, scalePoint } from 'd3';
import { useState, type PointerEvent } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  createChartInnerDimensions,
  createTooltipPosition,
  formatCompactPhpFromCents,
  formatBusinessDateLabel,
  formatPhpFromCents,
  formatQuantity,
  getDateLabelStep,
  getLinearTickValues,
} from '../../../components/charts';
import type { ChartTooltipState } from '../../../components/charts';

type ReportSalesTrendPoint = {
  date: string;
  revenueCents: number;
  transactions: number;
  unitsSold: number;
};

type ReportSalesTrendChartProps = {
  points: ReportSalesTrendPoint[];
};

type ChartPoint = ReportSalesTrendPoint & {
  x: number;
  y: number;
};

const chartHeight = 270;
const margin = {
  top: 22,
  right: 28,
  bottom: 44,
  left: 78,
};

const hiddenTooltip: ChartTooltipState = {
  visible: false,
  x: 0,
  y: 0,
  rows: [],
};

const numberFormatter = new Intl.NumberFormat('en-PH');

function tooltipForPoint(point: ReportSalesTrendPoint, x: number, y: number): ChartTooltipState {
  return {
    visible: true,
    x,
    y,
    title: formatBusinessDateLabel(point.date),
    rows: [
      { label: 'Revenue', value: formatPhpFromCents(point.revenueCents), tone: 'success' },
      { label: 'Transactions', value: numberFormatter.format(point.transactions), tone: 'info' },
      { label: 'Units Sold', value: formatQuantity(point.unitsSold), tone: 'neutral' },
    ],
  };
}

function nearestPoint(points: ChartPoint[], x: number) {
  return points.reduce((nearest, point) => (
    Math.abs(point.x - x) < Math.abs(nearest.x - x) ? point : nearest
  ), points[0]);
}

export default function ReportSalesTrendChart({ points }: ReportSalesTrendChartProps) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>(hiddenTooltip);
  const allZero = points.length > 0 && points.every((point) => point.revenueCents === 0);

  return (
    <ChartContainer
      className="reports-chart reports-sales-chart"
      minHeight={chartHeight}
      title="Daily completed-sales revenue for the selected Manila business-date period."
      description="Daily completed-sales revenue across the selected report period."
    >
      {(dimensions) => {
        if (!points.length) {
          return (
            <div className="chart-empty-state reports-chart__empty">
              No sales trend points are available.
            </div>
          );
        }

        const width = Math.max(dimensions.width, 320);
        const chart = createChartInnerDimensions({ width, height: chartHeight }, margin);
        const xScale = scalePoint<string>()
          .domain(points.map((point) => point.date))
          .range([margin.left, margin.left + chart.innerWidth])
          .padding(points.length > 1 ? 0.35 : 0.5);
        const maxRevenue = max(points, (point) => point.revenueCents) ?? 0;
        const yMax = maxRevenue > 0 ? maxRevenue * 1.12 : 1;
        const yScale = scaleLinear()
          .domain([0, yMax])
          .range([margin.top + chart.innerHeight, margin.top])
          .nice();
        const yTicks = getLinearTickValues(yScale, width < 520 ? 4 : 5);
        const step = getDateLabelStep(points.length, width);
        const coordinates = points.map((point) => ({
          ...point,
          x: xScale(point.date) ?? margin.left + chart.innerWidth / 2,
          y: yScale(point.revenueCents),
        }));
        const linePath = line<ChartPoint>()
          .x((point) => point.x)
          .y((point) => point.y);
        const path = linePath(coordinates);
        const showVisualPoints = points.length <= 45;

        function showTooltip(point: ReportSalesTrendPoint, x: number, y: number) {
          const position = createTooltipPosition(x, y, { width, height: chartHeight }, { height: 118, offsetY: 96 });
          setTooltip(tooltipForPoint(point, position.x, position.y));
        }

        function handlePointerMove(event: PointerEvent<SVGRectElement>) {
          const bounds = event.currentTarget.getBoundingClientRect();
          const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
          const point = nearestPoint(coordinates, pointerX);
          showTooltip(point, point.x, point.y);
        }

        return (
          <>
            {allZero ? (
              <p className="chart-zero-note reports-chart__zero-note">
                No completed sales were recorded in this report period.
              </p>
            ) : null}
            <svg
              viewBox={`0 0 ${width} ${chartHeight}`}
              role="img"
              aria-labelledby="reports-sales-trend-title reports-sales-trend-desc"
              className="reports-chart__svg"
            >
              <title id="reports-sales-trend-title">Sales Trend</title>
              <desc id="reports-sales-trend-desc">
                Daily completed-sales revenue across the selected report period.
              </desc>
              <g aria-hidden="true">
                {yTicks.map((tick) => {
                  const y = yScale(tick);
                  return (
                    <g key={tick}>
                      <line
                        className="reports-chart__grid"
                        x1={margin.left}
                        x2={margin.left + chart.innerWidth}
                        y1={y}
                        y2={y}
                      />
                      <text
                        className="reports-chart__y-label"
                        x={margin.left - 10}
                        y={y + 4}
                        textAnchor="end"
                      >
                        {formatCompactPhpFromCents(tick)}
                      </text>
                    </g>
                  );
                })}
                <line
                  className="reports-chart__axis"
                  x1={margin.left}
                  x2={margin.left + chart.innerWidth}
                  y1={margin.top + chart.innerHeight}
                  y2={margin.top + chart.innerHeight}
                />
                <line
                  className="reports-chart__axis"
                  x1={margin.left}
                  x2={margin.left}
                  y1={margin.top}
                  y2={margin.top + chart.innerHeight}
                />
              </g>
              {path ? <path className="reports-sales-chart__line" d={path} /> : null}
              {showVisualPoints ? coordinates.map((point) => (
                <circle
                  className="reports-sales-chart__point"
                  key={point.date}
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  aria-hidden="true"
                />
              )) : null}
              <rect
                className="reports-chart__overlay"
                x={margin.left}
                y={margin.top}
                width={chart.innerWidth}
                height={chart.innerHeight}
                onPointerEnter={handlePointerMove}
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setTooltip(hiddenTooltip)}
              />
              {coordinates.map((point, index) => {
                const labelVisible = index % step === 0 || index === coordinates.length - 1;
                const ariaLabel = `${formatBusinessDateLabel(point.date)} revenue ${formatPhpFromCents(point.revenueCents)}, ${numberFormatter.format(point.transactions)} transactions, ${formatQuantity(point.unitsSold)} units sold`;
                return (
                  <g key={point.date}>
                    {labelVisible ? (
                      <text x={point.x} y={chartHeight - 11} textAnchor="middle">
                        {formatBusinessDateLabel(point.date)}
                      </text>
                    ) : null}
                    {showVisualPoints ? (
                      <circle
                        className="chart-focus-ring reports-chart__point-hitarea"
                        cx={point.x}
                        cy={point.y}
                        r="10"
                        tabIndex={0}
                        aria-label={ariaLabel}
                        onPointerEnter={() => showTooltip(point, point.x, point.y)}
                        onPointerMove={() => showTooltip(point, point.x, point.y)}
                        onPointerLeave={() => setTooltip(hiddenTooltip)}
                        onFocus={() => showTooltip(point, point.x, point.y)}
                        onBlur={() => setTooltip(hiddenTooltip)}
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
            <ChartTooltip
              visible={tooltip.visible}
              x={tooltip.x}
              y={tooltip.y}
              title={tooltip.title}
              rows={tooltip.rows}
            />
          </>
        );
      }}
    </ChartContainer>
  );
}
