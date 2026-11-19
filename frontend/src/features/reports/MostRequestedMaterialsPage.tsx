import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { MATERIAL_TYPE_LABELS } from '../materials/api/search-materials';
import type { MaterialType } from '../materials/api/search-materials';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import {
  networkRequestApiError,
  RequestApiError,
} from '../requests/api/request-api-error';
import {
  barWidth,
  getMostRequestedMaterials,
  RANKING_LIMITS,
} from './api/most-requested-materials';
import type {
  MostRequestedMaterials,
  MostRequestedMaterialsParams,
  RankingLimit,
} from './api/most-requested-materials';
import styles from './MostRequestedMaterialsPage.module.css';

const DAY_FORMAT = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

interface RankingResponse {
  params: MostRequestedMaterialsParams;
  ranking: MostRequestedMaterials | null;
  error: RequestApiError | null;
}

function toApiError(caught: unknown): RequestApiError {
  return caught instanceof RequestApiError ? caught : networkRequestApiError();
}

function errorMessage(error: RequestApiError): string {
  if (error.status === 401) {
    return 'Su sesión no es válida o venció. Inicie sesión de nuevo.';
  }
  if (error.status === 403) {
    return 'Solo el personal del CLENA puede consultar los reportes.';
  }
  return error.message;
}

function formatDay(value: string): string {
  return DAY_FORMAT.format(new Date(`${value}T00:00:00Z`));
}

/** "del 1 de noviembre de 2026 al 30 de noviembre de 2026", or the whole history. */
function periodLabel(from: string | null, to: string | null): string {
  if (from && to) return `del ${formatDay(from)} al ${formatDay(to)}`;
  if (from) return `desde el ${formatDay(from)}`;
  if (to) return `hasta el ${formatDay(to)}`;
  return 'en todo el historial';
}

function typeLabel(type: string): string {
  return MATERIAL_TYPE_LABELS[type as MaterialType] ?? type;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * «Material más solicitado» (HU-26): ranking of the materials by the number
 * of requests, optionally only the ones registered in a date range. The bars
 * are plain HTML scaled to the largest count, so they fit any amount of data
 * and the screen readers read the numbers as text.
 */
export function MostRequestedMaterialsPage() {
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [params, setParams] = useState<MostRequestedMaterialsParams>({
    limit: RANKING_LIMITS[0],
  });
  // The answer remembers which params it belongs to: while they differ, it is loading
  const [response, setResponse] = useState<RankingResponse | null>(null);

  useEffect(() => {
    let ignore = false;
    getMostRequestedMaterials(params)
      .then((ranking) => {
        if (!ignore) setResponse({ params, ranking, error: null });
      })
      .catch((caught: unknown) => {
        if (!ignore)
          setResponse({ params, ranking: null, error: toApiError(caught) });
      });
    return () => {
      ignore = true;
    };
  }, [params]);

  const current = response?.params === params ? response : null;
  const loading = current === null;
  const ranking = current?.ranking ?? null;
  const error = current?.error ?? null;
  const maxCount = ranking?.items[0]?.requestCount ?? 0;

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // YYYY-MM-DD strings compare like the dates they hold
    if (fromInput && toInput && fromInput > toInput) {
      setRangeError('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    setRangeError(null);
    setParams((current) => ({
      ...current,
      from: fromInput || undefined,
      to: toInput || undefined,
    }));
  }

  function clearRange() {
    setFromInput('');
    setToInput('');
    setRangeError(null);
    setParams((current) => ({ limit: current.limit }));
  }

  function changeLimit(limit: RankingLimit) {
    setParams((current) => ({ ...current, limit }));
  }

  return (
    <AppLayout>
      <section
        className={searchStyles.hero}
        aria-labelledby="most-requested-title"
      >
        <p className={searchStyles.eyebrow}>Reportes</p>
        <h1 id="most-requested-title" className={searchStyles.title}>
          Material más solicitado
        </h1>
        <p className={styles.note}>
          Cuántas solicitudes incluyen cada material, para priorizar su
          conservación y atención. Cuenta las solicitudes de cualquier estado.
        </p>
      </section>

      <form
        className={styles.filters}
        onSubmit={applyRange}
        noValidate
        aria-label="Filtros del reporte"
      >
        <div className={styles.field}>
          <label htmlFor="report-from">Registradas desde</label>
          <input
            id="report-from"
            type="date"
            value={fromInput}
            max={toInput || undefined}
            onChange={(event) => setFromInput(event.target.value)}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'report-range-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="report-to">Registradas hasta</label>
          <input
            id="report-to"
            type="date"
            value={toInput}
            min={fromInput || undefined}
            onChange={(event) => setToInput(event.target.value)}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'report-range-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="report-limit">Mostrar</label>
          <select
            id="report-limit"
            value={params.limit}
            onChange={(event) =>
              changeLimit(Number(event.target.value) as RankingLimit)
            }
          >
            {RANKING_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {limit} materiales
              </option>
            ))}
          </select>
        </div>
        <div className={styles.actions}>
          <button className={searchStyles.primary} type="submit">
            Aplicar fechas
          </button>
          <button
            className={styles.secondary}
            type="button"
            onClick={clearRange}
            disabled={!fromInput && !toInput && !params.from && !params.to}
          >
            Quitar fechas
          </button>
        </div>
        {rangeError ? (
          <p id="report-range-error" className={styles.fieldError} role="alert">
            {rangeError}
          </p>
        ) : null}
      </form>

      <section className={styles.results} aria-labelledby="ranking-title">
        <h2 id="ranking-title" className={styles.sectionTitle}>
          Ranking
        </h2>

        {loading ? (
          <p className={searchStyles.muted} role="status">
            Cargando…
          </p>
        ) : null}

        {error ? (
          <div className={searchStyles.error} role="alert">
            <p>{errorMessage(error)}</p>
            {error.status === 401 ? (
              <Link to={ROUTES.login}>Iniciar sesión</Link>
            ) : null}
          </div>
        ) : null}

        {ranking ? (
          <>
            <p className={styles.summary}>
              {plural(
                ranking.totalRequests,
                'solicitud registrada',
                'solicitudes registradas',
              )}{' '}
              {periodLabel(ranking.from, ranking.to)}.
            </p>

            {ranking.items.length === 0 ? (
              <div className={searchStyles.empty}>
                <p className={searchStyles.emptyTitle}>
                  No hay solicitudes en este periodo
                </p>
                <p className={searchStyles.muted}>
                  Pruebe con otro rango de fechas o quite el filtro.
                </p>
              </div>
            ) : (
              <ol className={styles.ranking}>
                {ranking.items.map((item) => (
                  <li key={item.materialId} className={styles.row}>
                    <span className={styles.rank}>
                      <span className={styles.visuallyHidden}>Puesto </span>
                      {item.rank}
                    </span>
                    <span className={styles.material}>
                      <span className={styles.materialTitle} title={item.title}>
                        {item.title}
                      </span>
                      <span className={styles.materialMeta}>
                        {item.catalogCode} · {typeLabel(item.materialType)}
                      </span>
                    </span>
                    <span className={styles.track} aria-hidden="true">
                      <span
                        className={styles.bar}
                        data-testid="ranking-bar"
                        style={{
                          width: barWidth(item.requestCount, maxCount),
                        }}
                      />
                    </span>
                    <span className={styles.count}>
                      {plural(item.requestCount, 'solicitud', 'solicitudes')}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : null}
      </section>
    </AppLayout>
  );
}
