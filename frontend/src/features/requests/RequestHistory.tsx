import { useEffect, useState } from 'react';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import { getRequestHistory } from './api/get-request-history';
import type { RequestHistory as History } from './api/get-request-history';
import { REQUEST_STATUS_LABELS, RequestsApiError } from './api/list-requests';
import styles from './RequestHistory.module.css';

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

// The CLENA works in Bogotá: every change is shown in its local time
const CHANGED_AT_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface HistoryResponse {
  requestId: string;
  history: History | null;
  error: RequestsApiError | null;
}

interface RequestHistoryProps {
  requestId: string;
  // Names the list for screen readers, e.g. the tracking code
  label: string;
}

/**
 * The timeline of a request (HU-17): each status change, oldest first, with
 * the previous and new status, the date and who made it. Read only.
 */
export function RequestHistory({ requestId, label }: RequestHistoryProps) {
  // The answer remembers which request it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<HistoryResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    getRequestHistory(requestId)
      .then((history) => {
        if (!ignore) setResponse({ requestId, history, error: null });
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setResponse({
          requestId,
          history: null,
          error:
            caught instanceof RequestsApiError
              ? caught
              : new RequestsApiError(NETWORK_ERROR_MESSAGE, 0),
        });
      });
    return () => {
      ignore = true;
    };
  }, [requestId]);

  const isLoading = response?.requestId !== requestId;
  const history = isLoading ? null : response.history;
  const error = isLoading ? null : response.error;

  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading ? (
        <p className={searchStyles.muted}>Cargando historial…</p>
      ) : null}

      {error ? (
        <p className={searchStyles.error} role="alert">
          {error.status === 401
            ? 'Su sesión no es válida o venció.'
            : error.status === 403
              ? 'No tiene permiso para ver el historial de esta solicitud.'
              : error.message}
        </p>
      ) : null}

      {history && history.entries.length === 0 ? (
        <p className={searchStyles.muted}>
          Esta solicitud aún no tiene cambios registrados.
        </p>
      ) : null}

      {history && history.entries.length > 0 ? (
        <ol className={styles.timeline} aria-label={label}>
          {history.entries.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <time className={styles.date} dateTime={entry.changedAt}>
                {CHANGED_AT_FORMAT.format(new Date(entry.changedAt))}
              </time>
              <p className={styles.change}>
                {entry.previousStatus ? (
                  <>
                    <span className={styles.previous}>
                      {REQUEST_STATUS_LABELS[entry.previousStatus]}
                    </span>
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only"> pasó a </span>
                  </>
                ) : (
                  <span className={styles.previous}>Solicitud registrada: </span>
                )}
                <strong>{REQUEST_STATUS_LABELS[entry.newStatus]}</strong>
              </p>
              <p className={styles.meta}>Responsable: {entry.changedBy}</p>
              {entry.comment ? (
                <p className={styles.comment}>
                  <span className={styles.commentLabel}>
                    {entry.newStatus === 'RECHAZADA'
                      ? 'Motivo del rechazo:'
                      : 'Observación:'}
                  </span>{' '}
                  {entry.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
