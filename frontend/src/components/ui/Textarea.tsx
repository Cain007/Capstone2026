import { useId, type TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function Textarea({
  id,
  label,
  helperText,
  error,
  required,
  className,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const helperId = helperText ? `${textareaId}-helper` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="ui-field">
      {label ? (
        <div className="ui-field__label-row">
          <label className="ui-field__label" htmlFor={textareaId}>
            {label}
            {required ? <span className="ui-field__required"> *</span> : null}
          </label>
        </div>
      ) : null}
      <textarea
        {...props}
        id={textareaId}
        required={required}
        className={classNames('ui-textarea', className)}
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
