import type { ReactNode } from 'react';
import { cn } from 'cn';

type BentoPadding = 'compact' | 'standard' | 'analytical';
type BentoVariant = 'default' | 'muted' | 'table' | 'form' | 'analytical' | 'success' | 'warning' | 'danger';
type BentoSpan = 3 | 4 | 6 | 8 | 12 | 'full';

type SurfaceHeaderProps = {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export type BentoCardProps = SurfaceHeaderProps & {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  padding?: BentoPadding;
  variant?: BentoVariant;
  span?: BentoSpan;
  role?: string;
  'aria-label'?: string;
};

export function SurfaceHeader({ eyebrow, title, description, action }: SurfaceHeaderProps) {
  if (!eyebrow && !title && !description && !action) {
    return null;
  }

  return (
    <div className="surface-header">
      <div className="surface-header__copy">
        {eyebrow ? <p className="surface-header__eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="surface-header__title">{title}</h2> : null}
        {description ? <p className="surface-header__description">{description}</p> : null}
      </div>
      {action ? <div className="surface-header__action">{action}</div> : null}
    </div>
  );
}

export function BentoCard({
  children,
  className,
  contentClassName,
  padding = 'standard',
  variant = 'default',
  span,
  eyebrow,
  title,
  description,
  action,
  role,
  'aria-label': ariaLabel,
}: BentoCardProps) {
  return (
    <section
      className={cn(
        'bento-card',
        `bento-card--${variant}`,
        `bento-card--padding-${padding}`,
        span ? `bento-span-${span}` : undefined,
        className,
      )}
      role={role}
      aria-label={ariaLabel}
    >
      <SurfaceHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      {children ? <div className={cn('bento-card__content', contentClassName)}>{children}</div> : null}
    </section>
  );
}
