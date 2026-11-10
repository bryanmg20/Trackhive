import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import {
  changeRequestStatus,
  MAX_STATUS_COMMENT_LENGTH,
} from './api/change-request-status';
import type {
  ChangeRequestStatusResult,
  StatusChange,
} from './api/change-request-status';
import type { RequestDetail } from './api/get-request';
import { REQUEST_STATUS_LABELS, RequestsApiError } from './api/list-requests';
import type { RequestStatus } from './api/list-requests';
import detailStyles from './RequestDetailPage.module.css';
import styles from './ChangeRequestStatusForm.module.css';

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

// The CLENA works in Bogotá: show the date and time of the change there
const CHANGED_DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const CHANGED_TIME_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
});

const TRANSITION_HINTS: Partial<Record<RequestStatus, string>> = {
  EN_BUSQUEDA: 'Se empieza a buscar el material.',
  DISPONIBLE: 'El material fue localizado.',
  // From DISPONIBLE it is only offered for a digital delivery
  ATENDIDA: 'Se entregó la copia digital.',
  CERRADA: 'La solicitud termina y no admite más cambios.',
  RECHAZADA: 'No se atenderá. Debe escribir el motivo, que verá el solicitante.',
};

const REASON_REQUIRED_MESSAGE =
  'Escriba el motivo del rechazo: el solicitante lo verá en «Mis solicitudes».';

function describeTransition(
  from: RequestStatus,
  to: RequestStatus,
): { label: string; hint: string } {
  // From AGENDADA the staff records whether the requester came to the appointment
  if (from === 'AGENDADA' && to === 'ATENDIDA') {
    return { label: 'El solicitante asistió', hint: 'Pasa a Atendida.' };
  }
  if (from === 'AGENDADA' && to === 'DISPONIBLE') {
    return {
      label: 'El solicitante no asistió',
      hint: 'Vuelve a Disponible para agendar de nuevo.',
    };
  }
  return { label: REQUEST_STATUS_LABELS[to], hint: TRANSITION_HINTS[to] ?? '' };
}

interface SaveError {
  message: string;
  sessionExpired: boolean;
}

function toSaveError(caught: unknown): SaveError {
  if (!(caught instanceof RequestsApiError)) {
    return { message: NETWORK_ERROR_MESSAGE, sessionExpired: false };
  }
  if (caught.status === 401) {
    return {
      message: 'Su sesión no es válida o venció. Inicie sesión de nuevo.',
      sessionExpired: true,
    };
  }
  if (caught.status === 403) {
    return {
      message: 'No tiene permiso para cambiar el estado de la solicitud.',
      sessionExpired: false,
    };
  }
  // 409 (invalid transition or conflict) and 400 (rejection without a reason)
  // bring a clear message from the backend
  return { message: caught.message, sessionExpired: false };
}

function Confirmation({ change }: { change: StatusChange }) {
  const changedAt = new Date(change.changedAt);
  return (
    <p className={styles.confirmation} role="status">
      La solicitud pasó de{' '}
      <strong>{REQUEST_STATUS_LABELS[change.previousStatus]}</strong> a{' '}
      <strong>{REQUEST_STATUS_LABELS[change.newStatus]}</strong> el{' '}
      {CHANGED_DATE_FORMAT.format(changedAt)} a las{' '}
      {CHANGED_TIME_FORMAT.format(changedAt)}, por {change.changedBy.name}.
      {change.newStatus === 'RECHAZADA' && change.comment
        ? ` Motivo: «${change.comment}».`
        : null}
    </p>
  );
}

interface ChangeRequestStatusFormProps {
  request: RequestDetail;
  onChanged: (result: ChangeRequestStatusResult) => void;
}

/**
 * «Cambiar estado» action of the detail screen (HU-15). It offers only the
 * transitions the backend state machine allows from the current status.
 * Rejecting (HU-16) turns the comment into the required reason.
 */
export function ChangeRequestStatusForm({
  request,
  onChanged,
}: ChangeRequestStatusFormProps) {
  const [selected, setSelected] = useState<RequestStatus | ''>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<StatusChange | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // AGENDADA is only reached by scheduling an appointment (HU-18)
  const options = request.allowedTransitions.filter(
    (status) => status !== 'AGENDADA',
  );
  // When rejecting, the comment is the reason the requester reads (HU-16)
  const rejecting = selected === 'RECHAZADA';

  function choose(status: RequestStatus) {
    setSelected(status);
    setReasonError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError({ message: 'Elija el nuevo estado.', sessionExpired: false });
      return;
    }
    // The backend also refuses it; checking here avoids a useless request
    if (rejecting && !comment.trim()) {
      setError(null);
      setReasonError(REASON_REQUIRED_MESSAGE);
      commentRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    setLastChange(null);
    try {
      const result = await changeRequestStatus({
        requestId: request.id,
        status: selected,
        comment: comment.trim() || undefined,
      });
      setSelected('');
      setComment('');
      setLastChange(result.statusChange);
      onChanged(result);
    } catch (caught: unknown) {
      setError(toSaveError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={detailStyles.card} aria-labelledby="sec-status">
      <h2 id="sec-status" className={detailStyles.cardTitle}>
        Cambiar estado
      </h2>

      {lastChange ? <Confirmation change={lastChange} /> : null}

      {options.length === 0 ? (
        <p className={searchStyles.muted}>
          La solicitud está {REQUEST_STATUS_LABELS[request.status].toLowerCase()}:
          es un estado final y no admite más cambios.
        </p>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => void save(event)}
          noValidate
        >
          <fieldset className={styles.options}>
            <legend>
              Nuevo estado (actual: {REQUEST_STATUS_LABELS[request.status]})
            </legend>
            {options.map((status) => {
              const { label, hint } = describeTransition(request.status, status);
              const inputId = `new-status-${status}`;
              return (
                <div key={status} className={styles.option}>
                  <input
                    id={inputId}
                    type="radio"
                    name="new-status"
                    value={status}
                    checked={selected === status}
                    onChange={() => choose(status)}
                    aria-describedby={hint ? `${inputId}-hint` : undefined}
                  />
                  <label htmlFor={inputId}>{label}</label>
                  {hint ? (
                    <span id={`${inputId}-hint`} className={styles.hint}>
                      {hint}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="status-comment">
              {rejecting
                ? 'Motivo del rechazo (obligatorio)'
                : 'Comentario (opcional)'}
            </label>
            {rejecting ? (
              <span id="status-comment-hint" className={styles.fieldHint}>
                El solicitante lo verá en «Mis solicitudes».
              </span>
            ) : null}
            <textarea
              ref={commentRef}
              id="status-comment"
              rows={3}
              maxLength={MAX_STATUS_COMMENT_LENGTH}
              value={comment}
              aria-required={rejecting}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={
                [
                  rejecting ? 'status-comment-hint' : '',
                  reasonError ? 'status-comment-error' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onChange={(event) => {
                setComment(event.target.value);
                setReasonError(null);
              }}
            />
            {reasonError ? (
              <p
                id="status-comment-error"
                className={styles.fieldError}
                role="alert"
              >
                {reasonError}
              </p>
            ) : null}
          </div>

          {error ? (
            <div className={searchStyles.error} role="alert">
              <p>{error.message}</p>
              {error.sessionExpired ? (
                <Link to={ROUTES.login}>Iniciar sesión</Link>
              ) : null}
            </div>
          ) : null}

          <div>
            <button
              className={searchStyles.primary}
              type="submit"
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar cambio'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
