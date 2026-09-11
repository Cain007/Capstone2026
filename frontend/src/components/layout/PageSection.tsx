import type { ReactNode } from 'react';
import { cn } from 'cn';
import { SurfaceHeader } from './BentoCard';

type PageSectionProps = {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function PageSection({
  children,
  className,
  contentClassName,
  eyebrow,
  title,
  description,
  action,
}: PageSectionProps) {
  return (
    <section className={cn('page-section', className)}>
      <SurfaceHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      {children ? <div className={cn('page-section__content', contentClassName)}>{children}</div> : null}
    </section>
  );
}
