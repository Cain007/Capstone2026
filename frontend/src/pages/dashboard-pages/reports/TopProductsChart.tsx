import { max, scaleBand, scaleLinear } from 'd3';
import { useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  createChartInnerDimensions,
  createTooltipPosition,
  formatPhpFromCents,
  formatQuantity,
  getLinearTickValues,
} from '../../../components/charts';
import type { ChartTooltipState } from '../../../components/charts';

type TopProduct = {
  productId: string;
  sku: string;
  name: string;
  quantitySold: number;
  revenueCents: number;
};

type TopProductsChartProps = {
  products: TopProduct[];
};

const margin = {
  top: 18,
  right: 88,
  bottom: 32,
  left: 156,
};
const rowHeight = 38;
const minHeight = 180;

const hiddenTooltip: ChartTooltipState = {
  visible: false,
  x: 0,
  y: 0,
  rows: [],
};

function truncateLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function tooltipForProduct(product: TopProduct, x: number, y: number): ChartTooltipState {
  return {
    visible: true,
    x,
    y,
    title: product.name,
    rows: [
      { label: 'SKU', value: product.sku },
      { label: 'Quantity Sold', value: formatQuantity(product.quantitySold), tone: 'info' },
      { label: 'Revenue', value: formatPhpFromCents(product.revenueCents), tone: 'success' },
    ],
  };
}

export default function TopProductsChart({ products }: TopProductsChartProps) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>(hiddenTooltip);
  const allZero = products.length > 0 && products.every((product) => product.quantitySold === 0);
  const chartHeight = Math.max(minHeight, margin.top + margin.bottom + products.length * rowHeight);

  return (
    <ChartContainer
      className="reports-chart reports-top-products"
      minHeight={chartHeight}
      title="Top products by quantity sold."
      description="Top-selling products ranked by quantity sold during the selected report period."
    >
      {(dimensions) => {
        if (!products.length) {
          return (
            <div className="chart-empty-state reports-chart__empty">
              No top products are available for this report period.
            </div>
          );
        }

        if (allZero) {
          return (
            <div className="chart-empty-state reports-chart__empty">
              No product quantities were sold in this report period.
            </div>
          );
        }

        const width = Math.max(dimensions.width, 320);
        const leftMargin = width < 560 ? 126 : margin.left;
        const chart = createChartInnerDimensions(
          { width, height: chartHeight },
          { ...margin, left: leftMargin },
        );
        const yScale = scaleBand<string>()
          .domain(products.map((product) => product.productId))
          .range([margin.top, margin.top + chart.innerHeight])
          .padding(0.24);
        const maxQuantity = max(products, (product) => product.quantitySold) ?? 0;
        const xScale = scaleLinear()
          .domain([0, maxQuantity > 0 ? maxQuantity * 1.12 : 1])
          .range([leftMargin, leftMargin + chart.innerWidth])
          .nice();
        const xTicks = getLinearTickValues(
          xScale,
          width < 560 ? 3 : 5,
          { integerOnly: true, includeUpperBound: maxQuantity },
        );
        const labelLength = width < 560 ? 14 : 22;

        function showTooltip(product: TopProduct, x: number, y: number) {
          const position = createTooltipPosition(x, y, { width, height: chartHeight }, { height: 118, offsetY: 72 });
          setTooltip(tooltipForProduct(product, position.x, position.y));
        }

        return (
          <>
            <svg
              viewBox={`0 0 ${width} ${chartHeight}`}
              role="img"
              aria-labelledby="reports-top-products-title reports-top-products-desc"
              className="reports-chart__svg"
            >
              <title id="reports-top-products-title">Top Products</title>
              <desc id="reports-top-products-desc">
                Top-selling products ranked by quantity sold during the selected report period.
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
                        className="reports-top-products__x-label"
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
              {products.map((product) => {
                const y = yScale(product.productId) ?? margin.top;
                const barHeight = yScale.bandwidth();
                const x = xScale(product.quantitySold);
                const widthForValue = Math.max(0, x - leftMargin);
                const labelOutside = widthForValue < 44;
                const ariaLabel = `${product.name}, SKU ${product.sku}, quantity sold ${formatQuantity(product.quantitySold)}, revenue ${formatPhpFromCents(product.revenueCents)}`;

                return (
                  <g key={product.productId}>
                    <text
                      className="reports-top-products__label"
                      x={leftMargin - 10}
                      y={y + barHeight / 2 + 4}
                      textAnchor="end"
                    >
                      {truncateLabel(product.name, labelLength)}
                    </text>
                    <rect
                      className="reports-top-products__bar"
                      x={leftMargin}
                      y={y}
                      width={widthForValue}
                      height={barHeight}
                      aria-hidden="true"
                    />
                    <rect
                      className="chart-focus-ring reports-chart__bar-hitarea"
                      x={leftMargin}
                      y={y - 4}
                      width={chart.innerWidth}
                      height={barHeight + 8}
                      tabIndex={0}
                      aria-label={ariaLabel}
                      onPointerEnter={() => showTooltip(product, x, y + barHeight / 2)}
                      onPointerMove={() => showTooltip(product, x, y + barHeight / 2)}
                      onPointerLeave={() => setTooltip(hiddenTooltip)}
                      onFocus={() => showTooltip(product, x, y + barHeight / 2)}
                      onBlur={() => setTooltip(hiddenTooltip)}
                    />
                    <text
                      className={labelOutside ? 'reports-top-products__value reports-top-products__value--outside' : 'reports-top-products__value'}
                      x={labelOutside ? x + 6 : x - 6}
                      y={y + barHeight / 2 + 4}
                      textAnchor={labelOutside ? 'start' : 'end'}
                    >
                      {formatQuantity(product.quantitySold)}
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
