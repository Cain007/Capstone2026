import { line, max, scaleLinear, scalePoint } from 'd3';
import { useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  createChartInnerDimensions,
  createTooltipPosition,
  formatBusinessDateLabel,
  formatQuantity,
  getDateLabelStep,
  getLinearTickValues,
} from '../../../components/charts';
import type { ChartTooltipState } from '../../../components/charts';

type ForecastPoint = {
  date: string;
  predictedQuantity: number;
};

type ForecastChartProps = {
  points: ForecastPoint[];
};

type ChartPoint = ForecastPoint & {
  x: number;
  y: number;
};

const chartHeight = 260;
const margin = {
  top: 20,
  right: 28,
  bottom: 42,
  left: 62,
};

const hiddenTooltip: ChartTooltipState = {
  visible: false,
  x: 0,
  y: 0,
  rows: [],
};

function tooltipForPoint(point: ForecastPoint, x: number, y: number): ChartTooltipState {
  return {
    visible: true,
    x,
    y,
    title: formatBusinessDateLabel(point.date),
    rows: [
      {
        label: 'Predicted Demand',
        value: formatQuantity(point.predictedQuantity),
        tone: 'info',
      },
    ],
  };
}

export default function ForecastChart({ points }: ForecastChartProps) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>(hiddenTooltip);
  const allZero = points.length > 0 && points.every((point) => point.predictedQuantity === 0);

  return (
    <ChartContainer
      className="forecast-chart"
      minHeight={chartHeight}
      title="Predicted daily demand by forecast date."
      description="Predicted daily demand across the selected forecast horizon."
    >
      {(dimensions) => {
        if (!points.length) {
          return (
            <div className="chart-empty-state forecast-chart__empty">
              No forecast points are available.
            </div>
          );
        }

        const width = Math.max(dimensions.width, 320);
        const chart = createChartInnerDimensions({ width, height: chartHeight }, margin);
        const xScale = scalePoint<string>()
          .domain(points.map((point) => point.date))
          .range([margin.left, margin.left + chart.innerWidth])
          .padding(points.length > 1 ? 0.35 : 0.5);
        const maxQuantity = max(points, (point) => point.predictedQuantity) ?? 0;
        const yMax = maxQuantity > 0 ? maxQuantity * 1.12 : 1;
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
          y: yScale(point.predictedQuantity),
        }));
        const path = linePath(coordinates);

        function showTooltip(point: ForecastPoint, x: number, y: number) {
          const position = createTooltipPosition(x, y, { width, height: chartHeight }, { height: 96 });
          setTooltip(tooltipForPoint(point, position.x, position.y));
        }

        return (
          <>
            {allZero ? (
              <p className="chart-zero-note forecast-chart__zero-note">
                No demand is projected across this forecast horizon.
              </p>
            ) : null}
            <svg
              viewBox={`0 0 ${width} ${chartHeight}`}
              role="img"
              aria-labelledby="forecast-chart-title forecast-chart-desc"
              className="forecast-chart__svg"
            >
              <title id="forecast-chart-title">Predicted Demand Forecast</title>
              <desc id="forecast-chart-desc">
                Predicted daily demand across the selected forecast horizon.
              </desc>
              <g aria-hidden="true">
                {yTicks.map((tick) => {
                  const y = yScale(tick);
                  return (
                    <g key={tick}>
                      <line
                        className="forecast-chart__grid"
                        x1={margin.left}
                        x2={margin.left + chart.innerWidth}
                        y1={y}
                        y2={y}
                      />
                      <text
                        className="forecast-chart__y-label"
                        x={margin.left - 10}
                        y={y + 4}
                        textAnchor="end"
                      >
                        {formatQuantity(tick)}
                      </text>
                    </g>
                  );
                })}
                <line
                  className="forecast-chart__axis"
                  x1={margin.left}
                  x2={margin.left + chart.innerWidth}
                  y1={margin.top + chart.innerHeight}
                  y2={margin.top + chart.innerHeight}
                />
                <line
                  className="forecast-chart__axis"
                  x1={margin.left}
                  x2={margin.left}
                  y1={margin.top}
                  y2={margin.top + chart.innerHeight}
                />
              </g>
              {path ? <path className="forecast-chart__line" d={path} /> : null}
              {coordinates.map((point, index) => {
                const labelVisible = index % step === 0 || index === coordinates.length - 1;
                const ariaLabel = `${formatBusinessDateLabel(point.date)} predicted demand ${formatQuantity(point.predictedQuantity)}`;
                return (
                  <g key={point.date}>
                    <circle
                      className="chart-focus-ring forecast-chart__point-hitarea"
                      cx={point.x}
                      cy={point.y}
                      r="12"
                      tabIndex={0}
                      aria-label={ariaLabel}
                      onPointerEnter={() => showTooltip(point, point.x, point.y)}
                      onPointerMove={() => showTooltip(point, point.x, point.y)}
                      onPointerLeave={() => setTooltip(hiddenTooltip)}
                      onFocus={() => showTooltip(point, point.x, point.y)}
                      onBlur={() => setTooltip(hiddenTooltip)}
                    />
                    <circle
                      className="forecast-chart__point"
                      cx={point.x}
                      cy={point.y}
                      r="4"
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
