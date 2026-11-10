import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestDetailPath, ROUTES } from '../../routes';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import { SiteNav } from '../navigation/SiteNav';
import {
  listRequests,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  RequestsApiError,
} from './api/list-requests';
import type {
  ListRequestsParams,
  RequestPage,
  RequestSortField,
  RequestStatus,
  SortOrder,
} from './api/list-requests';
import styles from './RequestsListPage.module.css';

const PAGE_SIZE = 10;
const FORM_ID = 'request-search';
const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

const SORT_LABELS: Record<RequestSortField, string> = {
  registeredAt: 'Fecha de radicación',
  desiredDate: 'Fecha deseada',
};

interface ListResponse {
  params: ListRequestsParams;
  page: RequestPage | null;
  error: RequestsApiError | null;
}

/** "2026-12-01" -> "01/12/2026". Date-only text: no time zone conversion. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** Staff screen (HU-12): list the requests with filters, order and pages. */
export function RequestsListPage() {
  const [requester, setRequester] = useState('');
  const [material, setMaterial] = useState('');
  const [desiredFrom, setDesiredFrom] = useState('');
  const [desiredTo, setDesiredTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [params, setParams] = useState<ListRequestsParams>({
    sort: 'registeredAt',
    order: 'desc',
    page: 1,
    limit: PAGE_SIZE,
  });
  // The answer remembers which params it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<ListResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    listRequests(params)
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

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams((current) => ({
      ...current,
      requester: requester.trim() || undefined,
      material: material.trim() || undefined,
      desiredFrom: desiredFrom || undefined,
      desiredTo: desiredTo || undefined,
      page: 1,
    }));
  }

  function changeStatus(status: RequestStatus | '') {
    setParams((current) => ({
      ...current,
      status: status || undefined,
      page: 1,
    }));
  }

  // Dates apply as soon as they change, like the status; text waits for «Buscar»
  function changeDate(field: 'desiredFrom' | 'desiredTo', value: string) {
    if (field === 'desiredFrom') setDesiredFrom(value);
    else setDesiredTo(value);
    setParams((current) => ({
      ...current,
      [field]: value || undefined,
      page: 1,
    }));
  }

  function clearFilters() {
    setRequester('');
    setMaterial('');
    setDesiredFrom('');
    setDesiredTo('');
    // Keeps the order and the page size: only the filters go away
    setParams((current) => ({
      sort: current.sort,
      order: current.order,
      page: 1,
      limit: current.limit,
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

  const hasFilters = Boolean(
    params.status ||
    params.desiredFrom ||
    params.desiredTo ||
    params.requester ||
    params.material ||
    requester ||
    material,
  );
  const isLoading = response?.params !== params;
  const result = isLoading ? null : response.page;
  const error = isLoading ? null : response.error;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  return (
    <div className={searchStyles.shell}>
      <header className={searchStyles.topbar}>
        <p className={searchStyles.wordmark}>
          Trackhive<span className={searchStyles.wordmarkDot}>.</span>
        </p>
        <p className={searchStyles.topbarTag}>CLENA · Personal</p>
        <SiteNav />
      </header>

      <main className={searchStyles.main}>
        <section className={searchStyles.hero} aria-labelledby="requests-title">
          <p className={searchStyles.eyebrow}>Gestión del archivo</p>
          <h1 id="requests-title" className={searchStyles.title}>
            Solicitudes
          </h1>
          <form
            id={FORM_ID}
            className={searchStyles.searchBar}
            onSubmit={search}
            role="search"
          >
            <label htmlFor="request-requester" className="sr-only">
              Solicitante
            </label>
            <input
              id="request-requester"
              type="search"
              maxLength={100}
              value={requester}
              onChange={(event) => setRequester(event.target.value)}
              placeholder="Solicitante: nombre, correo o documento"
            />
            <button className={searchStyles.primary} type="submit">
              Buscar
            </button>
          </form>
          <p className={styles.shortcutRow}>
            <Link className={styles.shortcut} to={ROUTES.staffNewRequest}>
              Registrar solicitud de visitante ›
            </Link>
          </p>
        </section>

        <div className={searchStyles.layout}>
          <aside className={searchStyles.sidebar} aria-label="Filtros">
            <button
              type="button"
              className={searchStyles.filtersToggle}
              aria-expanded={filtersOpen}
              aria-controls="request-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filtros {filtersOpen ? '▴' : '▾'}
            </button>

            <div
              id="request-filters"
              className={searchStyles.filters}
              data-open={filtersOpen}
            >
              <fieldset className={searchStyles.group}>
                <legend>Estado</legend>
                <label className={searchStyles.option}>
                  <input
                    type="radio"
                    name="request-status"
                    checked={!params.status}
                    onChange={() => changeStatus('')}
                  />
                  Todos
                </label>
                {REQUEST_STATUSES.map((value) => (
                  <label key={value} className={searchStyles.option}>
                    <input
                      type="radio"
                      name="request-status"
                      checked={params.status === value}
                      onChange={() => changeStatus(value)}
                    />
                    {REQUEST_STATUS_LABELS[value]}
                  </label>
                ))}
              </fieldset>

              <div className={searchStyles.group}>
                <label htmlFor="request-material">Material</label>
                <input
                  id="request-material"
                  form={FORM_ID}
                  maxLength={100}
                  value={material}
                  onChange={(event) => setMaterial(event.target.value)}
                  placeholder="Título o código"
                />
                <p className={searchStyles.hint}>
                  Pulse Enter o «Buscar» para aplicar.
                </p>
              </div>

              <div className={`${searchStyles.group} ${styles.dates}`}>
                <label htmlFor="request-desired-from">
                  Fecha deseada desde
                </label>
                <input
                  id="request-desired-from"
                  form={FORM_ID}
                  type="date"
                  value={desiredFrom}
                  max={desiredTo || undefined}
                  onChange={(event) =>
                    changeDate('desiredFrom', event.target.value)
                  }
                />
                <label htmlFor="request-desired-to">Fecha deseada hasta</label>
                <input
                  id="request-desired-to"
                  form={FORM_ID}
                  type="date"
                  value={desiredTo}
                  min={desiredFrom || undefined}
                  onChange={(event) =>
                    changeDate('desiredTo', event.target.value)
                  }
                />
              </div>

              {hasFilters ? (
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={clearFilters}
                >
                  Quitar filtros
                </button>
              ) : null}
            </div>
          </aside>

          <section
            className={searchStyles.results}
            aria-labelledby="requests-results"
          >
            <div className={searchStyles.resultsHeader}>
              <h2 id="requests-results" className={searchStyles.sectionTitle}>
                {result ? `${result.total} solicitudes` : 'Solicitudes'}
              </h2>
              <div className={searchStyles.sortRow}>
                <label htmlFor="request-sort">Ordenar por</label>
                <select
                  id="request-sort"
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
                <label htmlFor="request-order" className="sr-only">
                  Dirección
                </label>
                <select
                  id="request-order"
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
                  <p className={searchStyles.emptyTitle}>
                    No encontramos solicitudes con esos filtros.
                  </p>
                  <p className={searchStyles.muted}>
                    Pruebe con otros filtros o quite alguno.
                  </p>
                </div>
              ) : null}
            </div>

            {result && result.items.length > 0 ? (
              <>
                <table className={searchStyles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Solicitud</th>
                      <th scope="col">Solicitante</th>
                      <th scope="col">Material</th>
                      <th scope="col">Fecha deseada</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={item.id}>
                        <td className={searchStyles.titleCell}>
                          <Link
                            className={styles.detailLink}
                            to={requestDetailPath(item.id)}
                          >
                            <strong>{item.trackingCode}</strong>
                          </Link>
                          <span className={searchStyles.code}>
                            Radicada {formatDate(item.registeredAt)}
                          </span>
                        </td>
                        <td data-label="Solicitante">
                          {item.requesterName}
                          {item.requesterEmail ? (
                            <span className={searchStyles.code}>
                              {item.requesterEmail}
                            </span>
                          ) : null}
                        </td>
                        <td data-label="Material">
                          <ul className={styles.materials}>
                            {item.materials.map((material) => (
                              <li key={material.id}>{material.title}</li>
                            ))}
                          </ul>
                        </td>
                        <td data-label="Fecha deseada">
                          {formatDate(item.desiredDate)}
                        </td>
                        <td data-label="Estado">
                          <span
                            className={styles.badge}
                            data-status={item.status}
                          >
                            {REQUEST_STATUS_LABELS[item.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
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
      </main>
    </div>
  );
}
