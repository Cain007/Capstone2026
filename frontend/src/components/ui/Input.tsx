import { useId, type InputHTMLAttributes } from 'react';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  helperText?: string;
  error?: string;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function Input({
  id,
  label,
  helperText,
  error,
  required,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="ui-field">
      {label ? (
        <div className="ui-field__label-row">
          <label className="ui-field__label" htmlFor={inputId}>
            {label}
            {required ? <span className="ui-field__required"> *</span> : null}
          </label>
        </div>
      ) : null}
      <input
        {...props}
        id={inputId}
        required={required}
        className={classNames('ui-input', className)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
      />
      {helperText ? (
        <p id={helperId} className="ui-field__helper">
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ui-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
