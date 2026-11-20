import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import {
  formatBogotaDateTime,
  getMaterialHistory,
} from './api/material-loans';
import type { MaterialHistoryResponse } from './api/material-loans';
import {
  MATERIAL_STATUS_LABELS,
  MaterialsApiError,
} from './api/search-materials';
import searchStyles from './MaterialSearchPage.module.css';
import styles from './MaterialHistoryModal.module.css';

const PAGE_SIZE = 10;
const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export interface MaterialHistoryModalProps {
  materialId: string;
  materialTitle: string;
  materialCatalogCode: string;
  onClose: () => void;
}

interface HistoryState {
  key: string;
  data: MaterialHistoryResponse | null;
  error: MaterialsApiError | null;
}

/** Displays who last had a material, when it was returned, and its custody log (HU-72). */
export function MaterialHistoryModal({
  materialId,
  materialTitle,
  materialCatalogCode,
  onClose,
}: MaterialHistoryModalProps) {
  const [page, setPage] = useState(1);
  const requestKey = `${materialId}:${page}`;
  const [state, setState] = useState<HistoryState | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let ignore = false;
    getMaterialHistory({ materialId, page, limit: PAGE_SIZE })
      .then((data) => {
        if (!ignore) setState({ key: requestKey, data, error: null });
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        const error =
          caught instanceof MaterialsApiError
            ? caught
            : new MaterialsApiError(NETWORK_ERROR_MESSAGE, 0);
        setState({ key: requestKey, data: null, error });
      });
    return () => {
      ignore = true;
    };
  }, [materialId, page, requestKey]);

  const isLoading = state?.key !== requestKey;
  const data = isLoading ? null : state.data;
  const error = isLoading ? null : state.error;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.limit))
    : 1;

  return (
    <div className={styles.backdrop}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-history-title"
      >
        <div className={styles.header}>
          <div>
            <h2 id="material-history-title" className={styles.title}>
              Historial de custodia · {materialTitle}
            </h2>
            <p className={styles.subtitle}>
              {materialCatalogCode}
              {data
                ? ` · Estado actual: ${MATERIAL_STATUS_LABELS[data.material.status]}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div aria-live="polite" aria-busy={isLoading}>
          {isLoading ? (
            <p className={searchStyles.muted}>Cargando historial…</p>
          ) : null}

          {error ? (
            <div className={searchStyles.error} role="alert">
              <p>
                {error.status === 401
                  ? 'Su sesión no es válida o venció.'
                  : error.message}
              </p>
              {error.status === 401 ? (
                <Link to={ROUTES.login}>Iniciar sesión</Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {data ? (
          data.lastLoan ? (
            <>
              <div className={styles.summary}>
                <h3 className={styles.summaryTitle}>Última custodia</h3>
                <p>
                  <strong>Última persona que lo tuvo:</strong>{' '}
                  {data.lastLoan.requester.name}
                </p>
                <p>
                  <strong>Entregado:</strong>{' '}
                  {formatBogotaDateTime(data.lastLoan.handedOverAt)} por{' '}
                  {data.lastLoan.handedOverBy.name}
                </p>
                <p>
                  <strong>Devuelto:</strong>{' '}
                  {data.lastLoan.returnedAt && data.lastLoan.returnedBy
                    ? `${formatBogotaDateTime(data.lastLoan.returnedAt)} · recibió ${data.lastLoan.returnedBy.name}`
                    : 'Actualmente en uso (pendiente de devolución)'}
                </p>
              </div>

              <ul
                className={styles.list}
                aria-label="Registros de entregas y devoluciones"
              >
                {data.items.map((loan) => (
                  <li key={loan.id} className={styles.entry}>
                    <div className={styles.entryHeader}>
                      <strong>{loan.requester.name}</strong>
                      <span className={styles.meta}>
                        {loan.appointment.trackingCode} · Cita del{' '}
                        {formatDate(loan.appointment.date)}
                      </span>
                    </div>
                    <p>
                      Entrega: {formatBogotaDateTime(loan.handedOverAt)} por{' '}
                      {loan.handedOverBy.name}
                    </p>
                    {loan.deliveryNotes ? (
                      <p className={styles.note}>
                        Nota de entrega: {loan.deliveryNotes}
                      </p>
                    ) : null}
                    <p>
                      Devolución:{' '}
                      {loan.returnedAt && loan.returnedBy
                        ? `${formatBogotaDateTime(loan.returnedAt)} · recibió ${loan.returnedBy.name}`
                        : 'Pendiente de devolución'}
                    </p>
                    {loan.returnNotes ? (
                      <p className={styles.note}>
                        Nota de devolución: {loan.returnNotes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {totalPages > 1 ? (
                <nav
                  className={styles.pagination}
                  aria-label="Paginación del historial"
                >
                  <button
                    type="button"
                    onClick={() => setPage((current) => current - 1)}
                    disabled={page <= 1}
                  >
                    ‹ Anterior
                  </button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={page >= totalPages}
                  >
                    Siguiente ›
                  </button>
                </nav>
              ) : null}
            </>
          ) : (
            <p className={searchStyles.muted}>
              Este material aún no registra entregas en sala.
            </p>
          )
        ) : null}
      </section>
    </div>
  );
}
