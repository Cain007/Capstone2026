import { line, max, scaleLinear, scalePoint } from 'd3';
import { useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  createChartInnerDimensions,
  createTooltipPosition,
  formatCompactPhpFromCents,
  formatBusinessDateLabel,
  formatPhpFromCents,
  getDateLabelStep,
  getLinearTickValues,
} from '../../../components/charts';
import type { ChartTooltipState } from '../../../components/charts';
import type { DashboardSalesTrendPoint } from '../../../types/dashboard';

type SalesTrendChartProps = {
  points: DashboardSalesTrendPoint[];
};

type ChartPoint = DashboardSalesTrendPoint & {
  x: number;
  y: number;
};

const chartHeight = 250;
const margin = {
  top: 20,
  right: 28,
  bottom: 42,
  left: 78,
};

const hiddenTooltip: ChartTooltipState = {
  visible: false,
  x: 0,
  y: 0,
  rows: [],
};

const numberFormatter = new Intl.NumberFormat('en-PH');

function tooltipForPoint(point: DashboardSalesTrendPoint, x: number, y: number): ChartTooltipState {
  return {
    visible: true,
    x,
    y,
    title: formatBusinessDateLabel(point.date),
    rows: [
      { label: 'Sales', value: formatPhpFromCents(point.revenueCents), tone: 'success' },
      { label: 'Transactions', value: numberFormatter.format(point.transactions), tone: 'info' },
    ],
  };
}

export default function SalesTrendChart({ points }: SalesTrendChartProps) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>(hiddenTooltip);
  const allZero = points.every((point) => point.revenueCents === 0);

  return (
    <ChartContainer
      className="real-dashboard-chart"
      minHeight={chartHeight}
      title="7-day sales revenue trend."
      description="Sales revenue over the last seven Manila business dates."
    >
      {(dimensions) => {
        if (!points.length) {
          return (
            <div className="chart-empty-state real-dashboard-chart__empty">
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
        const linePath = line<ChartPoint>()
          .x((point) => point.x)
          .y((point) => point.y);
        const coordinates = points.map((point) => ({
          ...point,
          x: xScale(point.date) ?? margin.left + chart.innerWidth / 2,
          y: yScale(point.revenueCents),
        }));
        const path = linePath(coordinates);

        function showTooltip(point: DashboardSalesTrendPoint, x: number, y: number) {
          const position = createTooltipPosition(x, y, { width, height: chartHeight }, { height: 96 });
          setTooltip(tooltipForPoint(point, position.x, position.y));
        }

        return (
          <>
            {allZero ? (
              <p className="chart-zero-note real-dashboard-chart__zero-note">No completed sales in the last 7 days.</p>
            ) : null}
            <svg
              viewBox={`0 0 ${width} ${chartHeight}`}
              role="img"
              aria-labelledby="sales-trend-title sales-trend-desc"
              className="real-dashboard-chart__svg"
            >
              <title id="sales-trend-title">7-Day Sales Trend</title>
              <desc id="sales-trend-desc">
                Sales revenue over the last seven Manila business dates.
              </desc>
              <g aria-hidden="true">
                {yTicks.map((tick) => {
                  const y = yScale(tick);
                  return (
                    <g key={tick}>
                      <line
                        className="real-dashboard-chart__grid"
                        x1={margin.left}
                        x2={margin.left + chart.innerWidth}
                        y1={y}
                        y2={y}
                      />
                      <text
                        className="real-dashboard-chart__y-label"
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
                  className="real-dashboard-chart__axis"
                  x1={margin.left}
                  x2={margin.left + chart.innerWidth}
                  y1={margin.top + chart.innerHeight}
                  y2={margin.top + chart.innerHeight}
                />
                <line
                  className="real-dashboard-chart__axis"
                  x1={margin.left}
                  x2={margin.left}
                  y1={margin.top}
                  y2={margin.top + chart.innerHeight}
                />
              </g>
              {path ? <path className="real-dashboard-chart__line" d={path} /> : null}
              {coordinates.map((point, index) => {
                const labelVisible = index % step === 0 || index === coordinates.length - 1;
                const ariaLabel = `${formatBusinessDateLabel(point.date)} sales ${formatPhpFromCents(point.revenueCents)}, ${numberFormatter.format(point.transactions)} transactions`;
                return (
                  <g key={point.date}>
                    <circle
                      className="chart-focus-ring real-dashboard-chart__point-hitarea"
                      cx={point.x}
                      cy={point.y}
                      r="13"
                      tabIndex={0}
                      aria-label={ariaLabel}
                      onPointerEnter={() => showTooltip(point, point.x, point.y)}
                      onPointerMove={() => showTooltip(point, point.x, point.y)}
                      onPointerLeave={() => setTooltip(hiddenTooltip)}
                      onFocus={() => showTooltip(point, point.x, point.y)}
                      onBlur={() => setTooltip(hiddenTooltip)}
                    />
                    <circle
                      className="real-dashboard-chart__point"
                      cx={point.x}
                      cy={point.y}
                      r="4.5"
                      aria-hidden="true"
                    />
                    {labelVisible ? (
                      <text x={point.x} y={chartHeight - 11} textAnchor="middle">
                        {formatBusinessDateLabel(point.date)}
                      </text>
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
