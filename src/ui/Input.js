import React, { useId } from "react";
import "./Input.css";

function Field({ label, error, help, htmlFor, children }) {
  return (
    <label className="ui-input" htmlFor={htmlFor}>
      {label && <span className="ui-input__label mono-label">{label}</span>}
      {children}
      {error ? (
        <span className="ui-input__error">{error}</span>
      ) : help ? (
        <span className="ui-input__help">{help}</span>
      ) : null}
    </label>
  );
}

export const Input = React.forwardRef(function Input(
  { label, error, help, id, className = "", ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <Field label={label} error={error} help={help} htmlFor={inputId}>
      <input
        ref={ref}
        id={inputId}
        className={`ui-input__control ${error ? "ui-input__control--error" : ""} ${className}`}
        {...rest}
      />
    </Field>
  );
});

export const Textarea = React.forwardRef(function Textarea(
  { label, error, help, id, className = "", rows = 4, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <Field label={label} error={error} help={help} htmlFor={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`ui-input__control ui-input__control--textarea ${error ? "ui-input__control--error" : ""} ${className}`}
        {...rest}
      />
    </Field>
  );
});

export const Select = React.forwardRef(function Select(
  { label, error, help, id, className = "", children, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <Field label={label} error={error} help={help} htmlFor={inputId}>
      <select
        ref={ref}
        id={inputId}
        className={`ui-input__control ui-input__control--select ${error ? "ui-input__control--error" : ""} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
});

export default Input;
