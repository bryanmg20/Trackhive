import { useState } from 'react';
import type { FormEvent } from 'react';
import { useModalDialog } from '../layout/use-modal-dialog';
import { MAX_LOAN_NOTES_LENGTH } from './api/material-loans';
import searchStyles from './MaterialSearchPage.module.css';
import styles from './LoanActionModal.module.css';

export type LoanActionMode = 'deliver' | 'return';

export interface LoanActionModalProps {
  mode: LoanActionMode;
  materialTitle: string;
  materialCatalogCode: string;
  submitting: boolean;
  error: string | null;
  onConfirm: (notes: string | undefined) => Promise<void> | void;
  onCancel: () => void;
}

/** Accessible confirmation dialog to record a material handover or return (HU-72). */
export function LoanActionModal({
  mode,
  materialTitle,
  materialCatalogCode,
  submitting,
  error,
  onConfirm,
  onCancel,
}: LoanActionModalProps) {
  const [notes, setNotes] = useState('');
  const dialog = useModalDialog();

  const isDeliver = mode === 'deliver';
  const title = isDeliver
    ? 'Registrar entrega de material'
    : 'Registrar devolución de material';
  const submitLabel = isDeliver
    ? submitting
      ? 'Registrando entrega…'
      : 'Confirmar entrega'
    : submitting
      ? 'Registrando devolución…'
      : 'Confirmar devolución';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onConfirm(notes.trim() || undefined);
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="loan-action-title"
      onCancel={(event) => {
        // Escape: the dialog stays mounted until the screen unmounts it
        event.preventDefault();
        if (!submitting) {
          onCancel();
        }
      }}
    >
      <h2 id="loan-action-title" className={styles.title}>
        {title}
      </h2>
      <p className={styles.subtitle}>
        <strong>{materialTitle}</strong> · {materialCatalogCode}
      </p>

      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="loan-action-notes">Observaciones (opcional)</label>
          <textarea
            id="loan-action-notes"
            rows={3}
            maxLength={MAX_LOAN_NOTES_LENGTH}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              isDeliver
                ? 'Ej.: Entregado en sala con guantes'
                : 'Ej.: Devuelto completo y en buen estado'
            }
          />
        </div>

        {error ? (
          <p className={searchStyles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="submit"
            className={searchStyles.primary}
            disabled={submitting}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
