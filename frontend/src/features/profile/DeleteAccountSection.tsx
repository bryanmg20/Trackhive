import { useRef, useState } from 'react';
import { deleteMyAccount } from './delete-account-api';
import styles from './ProfilePage.module.css';
export function DeleteAccountSection({ onDeleted }: { onDeleted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function close() {
    if (busy) return;
    dialog.current?.close();
    setConfirmed(false);
    setError('');
    opener.current?.focus();
  }
  async function remove() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteMyAccount();
      dialog.current?.close();
      onDeleted();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No pudimos eliminar su cuenta. Inténtelo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.danger} aria-labelledby="delete-account-title">
      <h2 id="delete-account-title">Eliminar mi cuenta</h2>
      <p>
        Se suprimirán sus datos personales y se cerrarán sus sesiones. Sus
        solicitudes se conservarán sin datos que le identifiquen para los
        reportes.
      </p>
      <button
        type="button"
        ref={opener}
        onClick={() => dialog.current?.showModal()}
      >
        Eliminar mi cuenta
      </button>
      <dialog
        ref={dialog}
        className={styles.deleteDialog}
        aria-labelledby="delete-confirm-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <h2 id="delete-confirm-title">Confirmar eliminación de cuenta</h2>
        <p>
          Esta acción es irreversible. Ya no podrá iniciar sesión con esta
          cuenta.
        </p>
        <label className={styles.confirmation}>
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.target.checked)}
          />{' '}
          Entiendo que se eliminarán mis datos personales y quiero eliminar mi
          cuenta.
        </label>
        {error && <p role="alert">{error}</p>}
        <div className={styles.deleteActions}>
          <button type="button" disabled={busy} onClick={close}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!confirmed || busy}
            aria-busy={busy}
            onClick={() => void remove()}
          >
            {busy ? 'Eliminando…' : 'Confirmar eliminación'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
