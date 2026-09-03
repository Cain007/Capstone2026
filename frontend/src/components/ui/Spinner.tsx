type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function Spinner({
  size = 'sm',
  label = 'Loading',
  className,
}: SpinnerProps) {
  return (
    <span
      className={classNames('ui-spinner', `ui-spinner--${size}`, className)}
      role="status"
      aria-label={label}
    />
  );
}
