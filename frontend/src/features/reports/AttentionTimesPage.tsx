import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { REQUEST_STATUS_LABELS } from '../requests/api/list-requests';
import {
  networkRequestApiError,
  RequestApiError,
} from '../requests/api/request-api-error';
import { formatDuration, getAttentionTimes } from './api/attention-times';
import type {
  AttentionTimes,
  AttentionTimesParams,
} from './api/attention-times';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import styles from './MostRequestedMaterialsPage.module.css';
import attentionStyles from './AttentionTimesPage.module.css';

export function AttentionTimesPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [params, setParams] = useState<AttentionTimesParams>({});
  const [response, setResponse] = useState<{
    params: AttentionTimesParams;
    data?: AttentionTimes;
    error?: RequestApiError;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    getAttentionTimes(params)
      .then((data) => {
        if (!ignore) setResponse({ params, data });
      })
      .catch((caught: unknown) => {
        if (!ignore)
          setResponse({
            params,
            error:
              caught instanceof RequestApiError
                ? caught
                : networkRequestApiError(),
          });
      });
    return () => {
      ignore = true;
    };
  }, [params]);

  const current = response?.params === params ? response : null;
  const data = current?.data;
  const error = current?.error;
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from && to && from > to) {
      setRangeError(
        'La fecha inicial no puede ser posterior a la fecha final.',
      );
      return;
    }
    setRangeError(null);
    setParams({ from: from || undefined, to: to || undefined });
  }

  return (
    <AppLayout>
      <section className={searchStyles.hero} aria-labelledby="attention-title">
        <p className={searchStyles.eyebrow}>Reportes · Administración</p>
        <h1 id="attention-title" className={searchStyles.title}>
          Tiempos de atención
        </h1>
        <p className={styles.note}>
          Tiempo transcurrido desde Recibida hasta Atendida. Incluye las
          solicitudes que después se cerraron.
        </p>
        <Link to={ROUTES.mostRequestedMaterials}>
          Ver material más solicitado
        </Link>
      </section>
      <form
        className={styles.filters}
        onSubmit={apply}
        noValidate
        aria-label="Filtros del reporte"
      >
        <div className={styles.field}>
          <label htmlFor="attention-from">Radicadas desde</label>
          <input
            id="attention-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby="attention-period-help attention-range-error"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="attention-to">Radicadas hasta</label>
          <input
            id="attention-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby="attention-period-help attention-range-error"
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={searchStyles.primary}>
            Aplicar fechas
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={!from && !to && !params.from && !params.to}
            onClick={() => {
              setFrom('');
              setTo('');
              setRangeError(null);
              setParams({});
            }}
          >
            Quitar fechas
          </button>
        </div>
        <p id="attention-period-help" className={attentionStyles.help}>
          El rango corresponde a la radicación, en hora de Bogotá, con ambos
          días incluidos. La duración completa incluye noches y fines de semana.
        </p>
        <p
          id="attention-range-error"
          className={styles.fieldError}
          role={rangeError ? 'alert' : undefined}
        >
          {rangeError}
        </p>
      </form>
      <section
        className={styles.results}
        aria-labelledby="attention-results"
        aria-busy={!current}
      >
        <h2 id="attention-results" className={styles.sectionTitle}>
          Promedios de atención
        </h2>
        {!current ? <p role="status">Cargando reporte…</p> : null}
        {error ? (
          <div className={searchStyles.error} role="alert">
            <p>
              {error.status === 401
                ? 'Su sesión no es válida o venció.'
                : error.status === 403
                  ? 'Solo ADMIN puede consultar los tiempos de atención.'
                  : error.message}
            </p>
            {error.status === 401 ? (
              <Link to={ROUTES.login}>Iniciar sesión</Link>
            ) : (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setParams({ ...params })}
              >
                Reintentar
              </button>
            )}
          </div>
        ) : null}
        {data ? (
          <>
            <p className={styles.summary}>
              Periodo de radicación: {data.from ?? 'sin fecha inicial'} —{' '}
              {data.to ?? 'sin fecha final'}.
            </p>
            <div className={attentionStyles.card}>
              <h3>Recibida → Atendida</h3>
              <p className={attentionStyles.duration}>
                {formatDuration(data.averageSeconds)}
              </p>
              <p>
                {data.completedRequests}{' '}
                {data.completedRequests === 1
                  ? 'solicitud atendida'
                  : 'solicitudes atendidas'}
              </p>
            </div>
            {data.completedRequests === 0 ? (
              <p role="status">No hay solicitudes atendidas para este rango.</p>
            ) : null}
            <h3>Tiempo promedio por estado</h3>
            <p className={styles.note}>
              Cada promedio considera solo las solicitudes atendidas que
              recorrieron ese estado. Si volvieron al mismo estado, se suma el
              tiempo de sus visitas. Un estado omitido no cuenta como cero.
            </p>
            <div className={attentionStyles.states}>
              {data.states.map((item) => (
                <section
                  className={attentionStyles.card}
                  key={item.state}
                  aria-label={REQUEST_STATUS_LABELS[item.state]}
                >
                  <h4>{REQUEST_STATUS_LABELS[item.state]}</h4>
                  <p className={attentionStyles.duration}>
                    {formatDuration(item.averageSeconds)}
                  </p>
                  <p>
                    {item.requestCount}{' '}
                    {item.requestCount === 1
                      ? 'solicitud considerada'
                      : 'solicitudes consideradas'}
                  </p>
                </section>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </AppLayout>
  );
}
