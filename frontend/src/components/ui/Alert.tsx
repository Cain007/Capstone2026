import type { HTMLAttributes, ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function Alert({
  variant = 'info',
  title,
  children,
  className,
  role,
  ...props
}: AlertProps) {
  const alertRole = role ?? (variant === 'error' ? 'alert' : 'status');

  return (
    <div
      {...props}
      className={classNames('ui-alert', `ui-alert--${variant}`, className)}
      role={alertRole}
    >
      <div>
        {title ? <p className="ui-alert__title">{title}</p> : null}
        <p className="ui-alert__description">{children}</p>
      </div>
    </div>
  );
}
