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

type ForecastEvaluationPoint = {
  date: string;
  predictedQuantity: number;
  actualQuantity: number;
  error: number;
  absoluteError: number;
};

type ForecastEvaluationChartProps = {
  points: ForecastEvaluationPoint[];
};

type ChartPoint = {
  date: string;
  quantity: number;
  x: number;
  y: number;
};

const chartHeight = 300;
const margin = {
  top: 24,
  right: 30,
  bottom: 44,
  left: 64,
};

const hiddenTooltip: ChartTooltipState = {
  visible: false,
  x: 0,
  y: 0,
  rows: [],
};

function resultLabel(error: number) {
  if (error > 0) return 'Over forecast';
  if (error < 0) return 'Under forecast';
  return 'Exact';
}

function resultTone(error: number): 'success' | 'warning' {
  return error === 0 ? 'success' : 'warning';
}

function tooltipForPoint(point: ForecastEvaluationPoint, x: number, y: number): ChartTooltipState {
  return {
    visible: true,
    x,
    y,
    title: formatBusinessDateLabel(point.date),
    rows: [
      { label: 'Predicted', value: formatQuantity(point.predictedQuantity), tone: 'info' },
      { label: 'Actual', value: formatQuantity(point.actualQuantity), tone: 'success' },
      { label: 'Difference', value: formatQuantity(point.error), tone: resultTone(point.error) },
      { label: 'Result', value: resultLabel(point.error), tone: resultTone(point.error) },
    ],
  };
}

export default function ForecastEvaluationChart({ points }: ForecastEvaluationChartProps) {
  const [tooltip, setTooltip] = useState<ChartTooltipState>(hiddenTooltip);
  const allZero = points.length > 0
    && points.every((point) => point.predictedQuantity === 0 && point.actualQuantity === 0);

  return (
    <ChartContainer
      className="forecast-evaluation-chart"
      minHeight={chartHeight}
      title="Predicted vs actual demand."
      description="Predicted demand compared with actual completed-sales demand across matured forecast dates."
    >
      {(dimensions) => {
        if (!points.length) {
          return (
            <div className="chart-empty-state forecast-evaluation-chart__empty">
              No evaluated forecast points are available.
            </div>
          );
        }

        const width = Math.max(dimensions.width, 320);
        const chart = createChartInnerDimensions({ width, height: chartHeight }, margin);
        const xScale = scalePoint<string>()
          .domain(points.map((point) => point.date))
          .range([margin.left, margin.left + chart.innerWidth])
          .padding(points.length > 1 ? 0.35 : 0.5);
        const maxQuantity = max(points.flatMap((point) => [
          point.predictedQuantity,
          point.actualQuantity,
        ])) ?? 0;
        const yMax = maxQuantity > 0 ? maxQuantity * 1.12 : 1;
        const yScale = scaleLinear()
          .domain([0, yMax])
          .range([margin.top + chart.innerHeight, margin.top])
          .nice();
        const yTicks = getLinearTickValues(yScale, width < 520 ? 4 : 5);
        const step = getDateLabelStep(points.length, width);
        const predictedPoints = points.map((point) => ({
          date: point.date,
          quantity: point.predictedQuantity,
          x: xScale(point.date) ?? margin.left + chart.innerWidth / 2,
          y: yScale(point.predictedQuantity),
        }));
        const actualPoints = points.map((point) => ({
          date: point.date,
          quantity: point.actualQuantity,
          x: xScale(point.date) ?? margin.left + chart.innerWidth / 2,
          y: yScale(point.actualQuantity),
        }));
        const linePath = line<ChartPoint>()
          .x((point) => point.x)
          .y((point) => point.y);
        const predictedPath = linePath(predictedPoints);
        const actualPath = linePath(actualPoints);

        function showTooltip(point: ForecastEvaluationPoint) {
          const x = xScale(point.date) ?? margin.left + chart.innerWidth / 2;
          const y = yScale(Math.max(point.predictedQuantity, point.actualQuantity));
          const position = createTooltipPosition(x, y, { width, height: chartHeight }, { height: 112, offsetY: 92 });
          setTooltip(tooltipForPoint(point, position.x, position.y));
        }

        return (
          <>
            <div className="forecast-evaluation-chart__legend" aria-hidden="true">
              <span>
                <i className="forecast-evaluation-chart__legend-line forecast-evaluation-chart__legend-line--predicted" />
                Predicted
              </span>
              <span>
                <i className="forecast-evaluation-chart__legend-line forecast-evaluation-chart__legend-line--actual" />
                Actual
              </span>
            </div>
            {allZero ? (
              <p className="chart-zero-note forecast-evaluation-chart__zero-note">
                Both predicted and actual demand were zero for the evaluated periods.
              </p>
            ) : null}
            <svg
              viewBox={`0 0 ${width} ${chartHeight}`}
              role="img"
              aria-labelledby="forecast-evaluation-chart-title forecast-evaluation-chart-desc"
              className="forecast-evaluation-chart__svg"
            >
              <title id="forecast-evaluation-chart-title">Predicted vs Actual Demand</title>
              <desc id="forecast-evaluation-chart-desc">
                Predicted demand compared with actual completed-sales demand across matured forecast dates.
              </desc>
              <g aria-hidden="true">
                {yTicks.map((tick) => {
                  const y = yScale(tick);
                  return (
                    <g key={tick}>
                      <line
                        className="forecast-evaluation-chart__grid"
                        x1={margin.left}
                        x2={margin.left + chart.innerWidth}
                        y1={y}
                        y2={y}
                      />
                      <text
                        className="forecast-evaluation-chart__y-label"
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
                  className="forecast-evaluation-chart__axis"
                  x1={margin.left}
                  x2={margin.left + chart.innerWidth}
                  y1={margin.top + chart.innerHeight}
                  y2={margin.top + chart.innerHeight}
                />
                <line
                  className="forecast-evaluation-chart__axis"
                  x1={margin.left}
                  x2={margin.left}
                  y1={margin.top}
                  y2={margin.top + chart.innerHeight}
                />
              </g>
              {predictedPath ? (
                <path className="forecast-evaluation-chart__line forecast-evaluation-chart__line--predicted" d={predictedPath} />
              ) : null}
              {actualPath ? (
                <path className="forecast-evaluation-chart__line forecast-evaluation-chart__line--actual" d={actualPath} />
              ) : null}
              {points.map((point, index) => {
                const x = xScale(point.date) ?? margin.left + chart.innerWidth / 2;
                const labelVisible = index % step === 0 || index === points.length - 1;
                const ariaLabel = `${formatBusinessDateLabel(point.date)} predicted ${formatQuantity(point.predictedQuantity)}, actual ${formatQuantity(point.actualQuantity)}, ${resultLabel(point.error)}`;

                return (
                  <g key={point.date}>
                    <rect
                      className="chart-focus-ring forecast-evaluation-chart__hitarea"
                      x={x - 14}
                      y={margin.top}
                      width="28"
                      height={chart.innerHeight}
                      tabIndex={0}
                      aria-label={ariaLabel}
                      onPointerEnter={() => showTooltip(point)}
                      onPointerMove={() => showTooltip(point)}
                      onPointerLeave={() => setTooltip(hiddenTooltip)}
                      onFocus={() => showTooltip(point)}
                      onBlur={() => setTooltip(hiddenTooltip)}
                    />
                    <circle
                      className="forecast-evaluation-chart__point forecast-evaluation-chart__point--predicted"
                      cx={x}
                      cy={yScale(point.predictedQuantity)}
                      r="4"
                      aria-hidden="true"
                    />
                    <rect
                      className="forecast-evaluation-chart__point forecast-evaluation-chart__point--actual"
                      x={x - 4}
                      y={yScale(point.actualQuantity) - 4}
                      width="8"
                      height="8"
                      aria-hidden="true"
                    />
                    {labelVisible ? (
                      <text x={x} y={chartHeight - 11} textAnchor="middle">
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
