import { max, scaleBand, scaleLinear } from 'd3';
import { useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  createChartInnerDimensions,
  createTooltipPosition,
  formatQuantity,
  getLinearTickValues,
} from '../../../components/charts';
import type { ChartTooltipState } from '../../../components/charts';

type InventoryHealthSummary = {
  totalProducts: number;
  outOfStock: number;
  critical: number;
  low: number;
  healthy: number;
  unconfigured: number;
};

type InventoryHealthKey = 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'HEALTHY' | 'UNCONFIGURED';

type InventoryHealthRow = {
  key: InventoryHealthKey;
  label: string;
  count: number;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  barClassName: string;
};

type InventoryHealthChartProps = {
  inventory: InventoryHealthSummary;
};

const margin = {
  top: 18,
  right: 72,
  bottom: 32,
  left: 132,
};
const chartHeight = 260;

const hiddenTooltip: ChartTooltipState = {
  visible: false,
  x: 0,
  y: 0,
  rows: [],
};

function getInventoryRows(inventory: InventoryHealthSummary): InventoryHealthRow[] {
  return [
    {
      key: 'OUT_OF_STOCK',
      label: 'Out of Stock',
      count: inventory.outOfStock,
      tone: 'danger',
      barClassName: 'reports-inventory-health__bar--out',
    },
    {
      key: 'CRITICAL',
      label: 'Critical',
      count: inventory.critical,
      tone: 'danger',
      barClassName: 'reports-inventory-health__bar--critical',
    },
    {
      key: 'LOW',
      label: 'Low',
      count: inventory.low,
      tone: 'warning',
      barClassName: 'reports-inventory-health__bar--low',
    },
    {
      key: 'HEALTHY',
      label: 'Healthy',
      count: inventory.healthy,
      tone: 'success',
      barClassName: 'reports-inventory-health__bar--healthy',
    },
    {
      key: 'UNCONFIGURED',
      label: 'Not Configured',
      count: inventory.unconfigured,
      tone: 'neutral',
      barClassName: 'reports-inventory-health__bar--unconfigured',
    },
  ];
}

function tooltipForRow(row: InventoryHealthRow, x: number, y: number): ChartTooltipState {
  return {
    visible: true,
    x,
    y,
    title: row.label,
    rows: [
      { label: 'Category', value: row.label },
      { label: 'Products', value: formatQuantity(row.count), tone: row.tone },
    ],
  };
}

export default function InventoryHealthChart({ inventory }: InventoryHealthChartProps) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>(hiddenTooltip);
  const rows = getInventoryRows(inventory);
  const allZero = rows.every((row) => row.count === 0);

  return (
    <ChartContainer
      className="reports-chart reports-inventory-health"
      minHeight={chartHeight}
      title="Inventory health by stock status."
      description="Current product counts grouped by stock health status."
    >
      {(dimensions) => {
        const width = Math.max(dimensions.width, 320);
        const leftMargin = width < 560 ? 126 : margin.left;
        const chart = createChartInnerDimensions(
          { width, height: chartHeight },
          { ...margin, left: leftMargin },
        );
        const maxCount = max(rows, (row) => row.count) ?? 0;
        const xScale = scaleLinear()
          .domain([0, maxCount > 0 ? maxCount * 1.12 : 1])
          .range([leftMargin, leftMargin + chart.innerWidth])
          .nice();
        const yScale = scaleBand<InventoryHealthKey>()
          .domain(rows.map((row) => row.key))
          .range([margin.top, margin.top + chart.innerHeight])
          .padding(0.26);
        const xTicks = getLinearTickValues(
          xScale,
          width < 560 ? 3 : 5,
          { integerOnly: true, includeUpperBound: maxCount },
        );

        function showTooltip(row: InventoryHealthRow, x: number, y: number) {
          const position = createTooltipPosition(x, y, { width, height: chartHeight }, { height: 112, offsetY: 64 });
          setTooltip(tooltipForRow(row, position.x, position.y));
        }

        return (
          <>
            {allZero ? (
              <p className="chart-zero-note reports-chart__zero-note">
                No products are currently represented in the inventory health summary.
              </p>
            ) : null}
            <svg
              viewBox={`0 0 ${width} ${chartHeight}`}
              role="img"
              aria-labelledby="reports-inventory-health-title reports-inventory-health-desc"
              className="reports-chart__svg"
            >
              <title id="reports-inventory-health-title">Inventory Health</title>
              <desc id="reports-inventory-health-desc">
                Current products grouped as out of stock, critical, low, healthy, and not configured.
              </desc>
              <g aria-hidden="true">
                {xTicks.map((tick) => {
                  const x = xScale(tick);
                  return (
                    <g key={tick}>
                      <line
                        className="reports-chart__grid"
                        x1={x}
                        x2={x}
                        y1={margin.top}
                        y2={margin.top + chart.innerHeight}
                      />
                      <text
                        className="reports-inventory-health__x-label"
                        x={x}
                        y={chartHeight - 9}
                        textAnchor="middle"
                      >
                        {formatQuantity(tick)}
                      </text>
                    </g>
                  );
                })}
                <line
                  className="reports-chart__axis"
                  x1={leftMargin}
                  x2={leftMargin + chart.innerWidth}
                  y1={margin.top + chart.innerHeight}
                  y2={margin.top + chart.innerHeight}
                />
              </g>
              {rows.map((row) => {
                const y = yScale(row.key) ?? margin.top;
                const barHeight = yScale.bandwidth();
                const x = xScale(row.count);
                const widthForValue = Math.max(0, x - leftMargin);
                const labelOutside = widthForValue < 38;
                const ariaLabel = `${row.label}, ${formatQuantity(row.count)} products`;

                return (
                  <g key={row.key}>
                    <text
                      className="reports-inventory-health__label"
                      x={leftMargin - 10}
                      y={y + barHeight / 2 + 4}
                      textAnchor="end"
                    >
                      {row.label}
                    </text>
                    <rect
                      className={`reports-inventory-health__bar ${row.barClassName}`}
                      x={leftMargin}
                      y={y}
                      width={widthForValue}
                      height={barHeight}
                      aria-hidden="true"
                    />
                    <rect
                      className="chart-focus-ring reports-inventory-health__hitarea"
                      x={leftMargin}
                      y={y - 4}
                      width={chart.innerWidth}
                      height={barHeight + 8}
                      tabIndex={0}
                      aria-label={ariaLabel}
                      onPointerEnter={() => showTooltip(row, x, y + barHeight / 2)}
                      onPointerMove={() => showTooltip(row, x, y + barHeight / 2)}
                      onPointerLeave={() => setTooltip(hiddenTooltip)}
                      onFocus={() => showTooltip(row, x, y + barHeight / 2)}
                      onBlur={() => setTooltip(hiddenTooltip)}
                    />
                    <text
                      className={labelOutside ? 'reports-inventory-health__value reports-inventory-health__value--outside' : 'reports-inventory-health__value'}
                      x={labelOutside ? x + 6 : x - 6}
                      y={y + barHeight / 2 + 4}
                      textAnchor={labelOutside ? 'start' : 'end'}
                    >
                      {formatQuantity(row.count)}
                    </text>
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
