import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { PageHeader } from '../layout/PageHeader';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import { listMyRequests } from './api/list-my-requests';
import { REFERENCE_DISPLAY_STATUS_LABELS } from './api/material-references';
import type { ListMyRequestsParams, MyRequestPage } from './api/list-my-requests';
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  RequestsApiError,
} from './api/list-requests';
import type {
  RequestSortField,
  RequestStatus,
  SortOrder,
} from './api/list-requests';
import styles from './MyRequestsPage.module.css';
import { RequestHistory } from './RequestHistory';
import listStyles from './RequestsListPage.module.css';

const PAGE_SIZE = 10;
const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

const SORT_LABELS: Record<RequestSortField, string> = {
  registeredAt: 'Fecha de radicación',
  desiredDate: 'Fecha deseada',
};

// The CLENA works in Bogotá: a request radicated at 8 p.m. keeps its local day
const REGISTERED_AT_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

interface ListResponse {
  params: ListMyRequestsParams;
  page: MyRequestPage | null;
  error: RequestsApiError | null;
}

/** "2026-12-01" -> "01/12/2026". Date-only text: no time zone conversion. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** Public user screen (HU-11): the status of my own requests. */
export function MyRequestsPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [params, setParams] = useState<ListMyRequestsParams>({
    sort: 'registeredAt',
    order: 'desc',
    page: 1,
    limit: PAGE_SIZE,
  });
  // The answer remembers which params it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<ListResponse | null>(null);
  // The request whose timeline is open (HU-17), one at a time. It remembers
  // its params: a new page or filter closes it
  const [openHistory, setOpenHistory] = useState<{
    params: ListMyRequestsParams;
    id: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    listMyRequests(params)
      .then((page) => {
        if (!ignore) setResponse({ params, page, error: null });
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setResponse({
          params,
          page: null,
          error:
            caught instanceof RequestsApiError
              ? caught
              : new RequestsApiError(NETWORK_ERROR_MESSAGE, 0),
        });
      });
    return () => {
      ignore = true;
    };
  }, [params]);

  function changeStatus(status: RequestStatus | '') {
    setParams((current) => ({
      ...current,
      status: status || undefined,
      page: 1,
    }));
  }

  function changeSort(sort: RequestSortField) {
    setParams((current) => ({ ...current, sort, page: 1 }));
  }

  function changeOrder(order: SortOrder) {
    setParams((current) => ({ ...current, order, page: 1 }));
  }

  function goToPage(page: number) {
    setParams((current) => ({ ...current, page }));
  }

  const isLoading = response?.params !== params;
  const result = isLoading ? null : response.page;
  const error = isLoading ? null : response.error;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  return (
    <AppLayout>
      <section
        className={searchStyles.hero}
        aria-labelledby="my-requests-title"
      >
        <PageHeader
          titleId="my-requests-title"
          title="Mis solicitudes"
          description="Consulte el estado y la información de sus solicitudes."
        />
        <p className={listStyles.shortcutRow}>
          <Link className={listStyles.shortcut} to={ROUTES.materials}>
            Buscar material para una nueva solicitud ›
          </Link>
        </p>
      </section>

      <div className={searchStyles.tableLayout}>
        <aside className={searchStyles.sidebar} aria-label="Filtros">
          <button
            type="button"
            className={searchStyles.filtersToggle}
            aria-expanded={filtersOpen}
            aria-controls="my-request-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filtros {filtersOpen ? '▴' : '▾'}
          </button>

          <div
            id="my-request-filters"
            className={searchStyles.filters}
            data-open={filtersOpen}
          >
            <fieldset className={searchStyles.group}>
              <legend>Estado</legend>
              <label className={searchStyles.option}>
                <input
                  type="radio"
                  name="my-request-status"
                  checked={!params.status}
                  onChange={() => changeStatus('')}
                />
                Todos
              </label>
              {REQUEST_STATUSES.map((value) => (
                <label key={value} className={searchStyles.option}>
                  <input
                    type="radio"
                    name="my-request-status"
                    checked={params.status === value}
                    onChange={() => changeStatus(value)}
                  />
                  {REQUEST_STATUS_LABELS[value]}
                </label>
              ))}
            </fieldset>
          </div>
        </aside>

        <section
          className={searchStyles.results}
          aria-labelledby="my-requests-results"
        >
          <div className={searchStyles.resultsHeader}>
            <h2
              id="my-requests-results"
              className={searchStyles.sectionTitle}
            >
              {result
                ? `${result.total} ${result.total === 1 ? 'solicitud' : 'solicitudes'}`
                : 'Solicitudes'}
            </h2>
            <div className={searchStyles.sortRow}>
              <label htmlFor="my-request-sort">Ordenar por</label>
              <select
                id="my-request-sort"
                value={params.sort}
                onChange={(event) =>
                  changeSort(event.target.value as RequestSortField)
                }
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label htmlFor="my-request-order" className="sr-only">
                Dirección
              </label>
              <select
                id="my-request-order"
                value={params.order}
                onChange={(event) =>
                  changeOrder(event.target.value as SortOrder)
                }
              >
                <option value="desc">Más recientes primero</option>
                <option value="asc">Más antiguas primero</option>
              </select>
            </div>
          </div>

          <div aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <p className={searchStyles.muted}>Cargando…</p>
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

            {result && result.items.length === 0 ? (
              <div className={searchStyles.empty}>
                {params.status ? (
                  <>
                    <p className={searchStyles.emptyTitle}>
                      No tiene solicitudes en estado «
                      {REQUEST_STATUS_LABELS[params.status]}».
                    </p>
                    <p className={searchStyles.muted}>
                      Elija otro estado o vea todas sus solicitudes.
                    </p>
                  </>
                ) : (
                  <>
                    <p className={searchStyles.emptyTitle}>
                      Aún no ha radicado solicitudes.
                    </p>
                    <p className={searchStyles.muted}>
                      Busque material en el archivo y pulse «Solicitar».{' '}
                      <Link to={ROUTES.materials}>Ir al buscador</Link>
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {result && result.items.length > 0 ? (
            <>
              <table className={searchStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Código de seguimiento</th>
                    <th scope="col">Fecha de radicación</th>
                    <th scope="col">Material</th>
                    <th scope="col">Fecha deseada</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => {
                    const historyOpen =
                      openHistory?.params === params &&
                      openHistory.id === item.id;
                    const historyId = `history-${item.id}`;
                    return (
                    <Fragment key={item.id}>
                    <tr>
                      <td className={searchStyles.titleCell}>
                        <strong>{item.trackingCode}</strong>
                      </td>
                      <td data-label="Fecha de radicación">
                        {REGISTERED_AT_FORMAT.format(
                          new Date(item.registeredAt),
                        )}
                      </td>
                      <td data-label="Material">
                        <ul className={listStyles.materials}>
                          {item.materials.map((material) => (
                            <li key={material.id}>{material.title}</li>
                          ))}
                          {item.references.map((reference) => (
                            <li key={reference.id}>
                              {reference.label}{' '}
                              <span
                                className={listStyles.referenceTag}
                                data-status={reference.displayStatus}
                              >
                                {REFERENCE_DISPLAY_STATUS_LABELS[
                                  reference.displayStatus
                                ]}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td data-label="Fecha deseada">
                        {formatDate(item.desiredDate)}
                      </td>
                      <td data-label="Estado">
                        <span
                          className={listStyles.badge}
                          data-status={item.status}
                        >
                          {REQUEST_STATUS_LABELS[item.status]}
                        </span>
                        {/* The requester sees why it was rejected (HU-16) */}
                        {item.status === 'RECHAZADA' &&
                        item.rejectionReason ? (
                          <p className={styles.reason}>
                            <span className={styles.reasonLabel}>
                              Motivo del rechazo:
                            </span>{' '}
                            {item.rejectionReason}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className={styles.historyToggle}
                          aria-expanded={historyOpen}
                          aria-controls={historyOpen ? historyId : undefined}
                          // Names the request: there is one button per row
                          aria-label={`${historyOpen ? 'Ocultar' : 'Ver'} historial de ${item.trackingCode}`}
                          onClick={() =>
                            setOpenHistory(
                              historyOpen ? null : { params, id: item.id },
                            )
                          }
                        >
                          {historyOpen ? 'Ocultar historial' : 'Ver historial'}
                        </button>
                      </td>
                    </tr>
                    {historyOpen ? (
                      <tr className={styles.historyRow}>
                        <td id={historyId} colSpan={5}>
                          <RequestHistory
                            requestId={item.id}
                            label={`Historial de estados de ${item.trackingCode}`}
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>

              <nav
                className={searchStyles.pagination}
                aria-label="Paginación"
              >
                <button
                  type="button"
                  onClick={() => goToPage(params.page - 1)}
                  disabled={params.page <= 1}
                >
                  ‹ Anterior
                </button>
                <span>
                  Página {params.page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(params.page + 1)}
                  disabled={params.page >= totalPages}
                >
                  Siguiente ›
                </button>
              </nav>
            </>
          ) : null}
        </section>
      </div>
    </AppLayout>
  );
}
