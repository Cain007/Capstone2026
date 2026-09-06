import { useId, type ReactNode } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import type { ChartDimensions } from './chartTypes';
import './charts.css';

type ChartContainerProps = {
  title?: ReactNode;
  description?: ReactNode;
  minHeight?: number;
  className?: string;
  children: (dimensions: ChartDimensions) => ReactNode;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function ChartContainer({
  title,
  description,
  minHeight = 220,
  className,
  children,
}: ChartContainerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { ref, size } = useElementSize<HTMLDivElement>();
  const dimensions = {
    width: size.width,
    height: Math.max(size.height, minHeight),
  };

  return (
    <figure
      className={classNames('chart-container', className)}
      style={{ minHeight }}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
    >
      {title ? (
        <figcaption id={titleId} className="chart-container__title">
          {title}
        </figcaption>
      ) : null}
      {description ? (
        <p id={descriptionId} className="chart-container__description">
          {description}
        </p>
      ) : null}
      <div ref={ref} className="chart-container__measure" style={{ minHeight }}>
        {size.width > 0 ? children(dimensions) : null}
      </div>
    </figure>
  );
}
