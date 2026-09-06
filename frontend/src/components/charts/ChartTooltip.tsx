import type { CSSProperties, ReactNode } from 'react';
import type { ChartTooltipRow } from './chartTypes';

type ChartTooltipProps = {
  visible: boolean;
  x: number;
  y: number;
  title?: ReactNode;
  rows: ChartTooltipRow[];
  className?: string;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function ChartTooltip({
  visible,
  x,
  y,
  title,
  rows,
  className,
}: ChartTooltipProps) {
  if (!visible) return null;

  const style = {
    '--chart-tooltip-x': `${x}px`,
    '--chart-tooltip-y': `${y}px`,
  } as CSSProperties;

  return (
    <div className={classNames('chart-tooltip', className)} style={style} role="status">
      {title ? <div className="chart-tooltip__title">{title}</div> : null}
      <dl className="chart-tooltip__rows">
        {rows.map((row) => (
          <div className="chart-tooltip__row" data-tone={row.tone ?? 'neutral'} key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
