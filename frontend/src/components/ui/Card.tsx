import type { HTMLAttributes } from 'react';

type CardPadding = 'compact' | 'default' | 'spacious';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: CardPadding;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function Card({
  padding = 'default',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={classNames('ui-card', `ui-card--${padding}`, className)}
    >
      {children}
    </div>
  );
}
