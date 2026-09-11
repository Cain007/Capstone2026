import type { ReactNode } from 'react';
import { cn } from 'cn';

type BentoGridGap = 'compact' | 'standard' | 'relaxed';

type BentoGridProps = {
  children: ReactNode;
  className?: string;
  columns?: 6 | 12;
  dense?: boolean;
  gap?: BentoGridGap;
  'aria-label'?: string;
};

export function BentoGrid({
  children,
  className,
  columns = 12,
  dense = false,
  gap = 'standard',
  'aria-label': ariaLabel,
}: BentoGridProps) {
  return (
    <div
      className={cn(
        'bento-grid',
        columns === 6 ? 'bento-grid--6' : 'bento-grid--12',
        dense ? 'bento-grid--dense' : undefined,
        `bento-grid--gap-${gap}`,
        className,
      )}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
