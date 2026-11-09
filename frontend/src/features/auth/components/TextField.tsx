import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import styles from './TextField.module.css';

interface TextFieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  autoComplete: string;
  registration: UseFormRegisterReturn;
  hint?: string;
  error?: string;
  // Shows an "Opcional" tag; screen readers hear "(opcional)" in the label
  optional?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  autoCapitalize?: InputHTMLAttributes<HTMLInputElement>['autoCapitalize'];
  spellCheck?: boolean;
}

export function TextField({
  id,
  label,
  type = 'text',
  autoComplete,
  registration,
  hint,
  error,
  optional = false,
  inputMode,
  autoCapitalize,
  spellCheck,
}: TextFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isPassword = type === 'password';
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const inputType = isPassword && isVisible ? 'text' : type;
  const inputClassName = [styles.input, error ? styles.inputError : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
          {optional ? <span className="sr-only"> (opcional)</span> : null}
        </label>
        {optional ? (
          <span className={styles.optional} aria-hidden="true">
            Opcional
          </span>
        ) : null}
        {isPassword ? (
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={isVisible}
            aria-controls={id}
            aria-label={`${isVisible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
            onClick={() => setIsVisible((visible) => !visible)}
          >
            {isVisible ? 'Ocultar' : 'Mostrar'}
          </button>
        ) : null}
      </div>

      <input
        id={id}
        type={inputType}
        className={inputClassName}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...registration}
      />

      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} id={errorId}>
          <span className={styles.errorMark} aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
