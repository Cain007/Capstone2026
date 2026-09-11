import type { ReactNode } from 'react';
import { cn } from 'cn';

type MetricTone = 'default' | 'success' | 'warning' | 'danger';

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: MetricTone;
  className?: string;
};

export function MetricCard({ label, value, helper, icon, action, tone = 'default', className }: MetricCardProps) {
  return (
    <article className={cn('metric-card', `metric-card--${tone}`, className)}>
      <div className="metric-card__topline">
        <span className="metric-card__label">{label}</span>
        {icon ? <span className="metric-card__icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <strong className="metric-card__value">{value}</strong>
      <div className="metric-card__footer">
        {helper ? <p className="metric-card__helper">{helper}</p> : null}
        {action ? <div className="metric-card__action">{action}</div> : null}
      </div>
    </article>
  );
}
