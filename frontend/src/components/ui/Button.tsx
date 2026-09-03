import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Spinner from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function Button({
  variant = 'primary',
  loading = false,
  iconStart,
  iconEnd,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={type}
      className={classNames('ui-button', `ui-button--${variant}`, className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner label="Loading" /> : null}
      {!loading && iconStart ? (
        <span className="ui-button__icon" aria-hidden="true">
          {iconStart}
        </span>
      ) : null}
      {children}
      {!loading && iconEnd ? (
        <span className="ui-button__icon" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}
