import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { PageHeader } from '../layout/PageHeader';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import {
  networkRequestApiError,
  RequestApiError,
} from '../requests/api/request-api-error';
import { getSyncStatus, requestSync } from './api/everything-sync';
import type {
  CurrentSyncRun,
  SyncRun,
  SyncStatus,
} from './api/everything-sync';
import styles from './EverythingSyncPage.module.css';
import { dateTime, timeAgo } from './sync-times';

// While a run is PEDIDA or EN_CURSO the state changes in seconds: the screen
// asks often, so the new result shows as soon as the agent ends
export const BUSY_REFRESH_MS = 5_000;
export const IDLE_REFRESH_MS = 30_000;

interface Notice {
  kind: 'success' | 'warning' | 'error';
  text: string;
  signIn?: boolean;
}

function toApiError(caught: unknown): RequestApiError {
  return caught instanceof RequestApiError ? caught : networkRequestApiError();
}

/** The message for an error the API answered, in the words of the screen. */
function errorText(error: RequestApiError): string {
  if (error.status === 401) {
    return 'Su sesión no es válida o venció. Inicie sesión de nuevo.';
  }
  if (error.status === 403) {
    return 'Solo un administrador puede ver y pedir la sincronización con Everything.';
  }
  return error.message;
}

function requestNotice(error: RequestApiError): Notice {
  if (
    error.code === 'SYNC_RUN_ALREADY_REQUESTED' ||
    error.code === 'SYNC_RUN_ALREADY_RUNNING'
  ) {
    return { kind: 'warning', text: error.message };
  }
  if (error.code === 'EVERYTHING_SYNC_DISABLED') {
    return {
      kind: 'warning',
      text: 'La integración con Everything está desactivada en este servidor: no se pidió la sincronización.',
    };
  }
  return { kind: 'error', text: errorText(error), signIn: error.status === 401 };
}

/** A run PEDIDA or EN_CURSO that is still alive: no other one is asked for. */
function busyRun(status: SyncStatus | null): CurrentSyncRun | null {
  const run = status?.currentRun ?? null;
  return run && !run.expired ? run : null;
}

function busyNotice(run: CurrentSyncRun): Notice {
  return {
    kind: 'warning',
    text:
      run.status === 'PEDIDA'
        ? `Ya hay una sincronización pedida ${timeAgo(run.requestedAt ?? run.lastActivityAt)} que espera al agente, así que no se pidió otra. Verá el resultado aquí cuando el agente la tome y termine.`
        : 'Ya hay una sincronización en curso, así que no se pidió otra. Verá el resultado aquí cuando termine.',
  };
}

function finishedNotice(run: SyncRun): Notice {
  return run.status === 'OK'
    ? {
        kind: 'success',
        text: `La sincronización terminó correctamente: ${folders(run.filesCount)}.`,
      }
    : {
        kind: 'error',
        text: `La sincronización terminó con error: ${run.errorMessage ?? 'sin detalle'}.`,
      };
}

function folders(count: number): string {
  return `${count.toLocaleString('es-CO')} ${count === 1 ? 'carpeta recibida' : 'carpetas recibidas'}`;
}

/** «hace 5 minutos (24/11/2026, 3:05 p. m.)», with the date for screen readers too. */
function When({ iso }: { iso: string }) {
  return (
    <>
      <time dateTime={iso}>{timeAgo(iso)}</time>{' '}
      <span className={styles.exact}>({dateTime(iso)})</span>
    </>
  );
}

function CurrentRunState({ run }: { run: CurrentSyncRun | null }) {
  if (!run) {
    return (
      <p className={styles.stateText}>
        No hay ninguna sincronización pedida ni en curso.
      </p>
    );
  }
  if (run.status === 'PEDIDA') {
    return (
      <>
        <p className={styles.stateTitle} data-state="PEDIDA">
          Pedida, esperando al agente
        </p>
        <p className={styles.stateText}>
          Se pidió <When iso={run.requestedAt ?? run.lastActivityAt} />.
        </p>
        <p className={styles.hint}>
          El agente del CLENA la toma la próxima vez que pregunta a Trackhive,
          cada minuto mientras el PC está encendido. Si el PC está apagado, la
          sincronización sigue pedida hasta que se encienda.
        </p>
      </>
    );
  }
  if (run.expired) {
    return (
      <>
        <p className={styles.stateTitle} data-state="VENCIDA">
          En curso, sin noticias del agente
        </p>
        <p className={styles.stateText}>
          El agente dejó de enviar carpetas{' '}
          <When iso={run.lastActivityAt} />: se cerró o perdió la conexión.
        </p>
        <p className={styles.hint}>
          Si pide otra sincronización, esta termina con error sin marcar
          ninguna copia como no encontrada.
        </p>
      </>
    );
  }
  return (
    <>
      <p className={styles.stateTitle} data-state="EN_CURSO">
        En curso: el agente está enviando las carpetas
      </p>
      <p className={styles.stateText}>
        Empezó <When iso={run.startedAt ?? run.lastActivityAt} /> y lleva{' '}
        {folders(run.filesCount)}.
      </p>
    </>
  );
}

function LastRun({ run }: { run: SyncRun | null }) {
  if (!run) {
    return (
      <p className={styles.stateText}>Todavía no hay sincronizaciones.</p>
    );
  }
  const ok = run.status === 'OK';
  return (
    <>
      <p className={styles.result} data-result={run.status}>
        {ok ? 'Terminó correctamente' : 'Terminó con error'}
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>Cuándo</dt>
          <dd>
            {run.finishedAt ? <When iso={run.finishedAt} /> : 'Sin fecha'}
          </dd>
        </div>
        <div>
          <dt>Carpetas</dt>
          <dd>{folders(run.filesCount)}</dd>
        </div>
        <div>
          <dt>Origen</dt>
          <dd>
            {run.requestedAt
              ? 'Pedida con «Sincronizar ahora»'
              : 'Sincronización diaria del agente'}
          </dd>
        </div>
        {!ok ? (
          <div>
            <dt>Motivo del error</dt>
            <dd className={styles.reason}>
              {run.errorMessage ?? 'Sin detalle'}
            </dd>
          </div>
        ) : null}
      </dl>
    </>
  );
}

/**
 * ADMIN screen (HU-138, WF-14): how the last sync with Everything ended, the
 * run requested or in progress, the last contact of the agent of the CLENA
 * and «Sincronizar ahora». It refreshes itself, so the new result shows when
 * the agent takes the run and ends it.
 */
export function EverythingSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loadError, setLoadError] = useState<RequestApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // The run PEDIDA or EN_CURSO last seen: when it ends, its result is announced
  const watchedRun = useRef<string | null>(null);
  const confirmTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let ignore = false;
    let inFlight = false;
    let timer: number | undefined;

    function schedule(ms: number) {
      window.clearTimeout(timer);
      timer = window.setTimeout(refreshIfVisible, ms);
    }

    async function load() {
      // A slow answer must not overlap with the timer or the tab activation
      if (inFlight) return;
      inFlight = true;
      try {
        const loaded = await getSyncStatus();
        if (ignore) return;
        const watched = watchedRun.current;
        if (
          watched &&
          loaded.currentRun?.id !== watched &&
          loaded.lastRun?.id === watched
        ) {
          setNotice(finishedNotice(loaded.lastRun));
        }
        watchedRun.current = loaded.currentRun?.id ?? null;
        setStatus(loaded);
        setLoadError(null);
        schedule(busyRun(loaded) ? BUSY_REFRESH_MS : IDLE_REFRESH_MS);
      } catch (caught: unknown) {
        if (ignore) return;
        setLoadError(toApiError(caught));
        schedule(IDLE_REFRESH_MS);
      } finally {
        inFlight = false;
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === 'visible') {
        void load();
      } else {
        schedule(IDLE_REFRESH_MS);
      }
    }

    void load();
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [reloadKey]);

  // Move the focus to the confirmation when it opens
  useEffect(() => {
    if (confirming) {
      confirmTitle.current?.focus();
    }
  }, [confirming]);

  function pressSyncNow() {
    setNotice(null);
    const busy = busyRun(status);
    if (busy) {
      // No other one is asked for: the screen says why
      setNotice(busyNotice(busy));
      return;
    }
    setConfirming(true);
  }

  async function confirmSyncNow() {
    setSaving(true);
    try {
      const run = await requestSync();
      watchedRun.current = run.id;
      setStatus((current) =>
        current ? { ...current, currentRun: { ...run, expired: false } } : current,
      );
      setNotice({
        kind: 'success',
        text: 'Sincronización pedida: queda esperando al agente del CLENA. Esta pantalla se actualiza sola cuando el agente la tome y termine.',
      });
    } catch (caught: unknown) {
      setNotice(requestNotice(toApiError(caught)));
    } finally {
      setSaving(false);
      setConfirming(false);
      // Ask the state again now, and every few seconds while it is busy
      setReloadKey((key) => key + 1);
    }
  }

  const enabled = status?.enabled ?? false;

  return (
    <AppLayout>
      <section
        className={searchStyles.hero}
        aria-labelledby="everything-sync-title"
      >
        <PageHeader
          titleId="everything-sync-title"
          title="Sincronización con Everything"
          description="Sincronice las referencias de copias digitales y consulte el resultado."
        />
      </section>

      {!status && !loadError ? (
        <p className={searchStyles.muted}>Cargando…</p>
      ) : null}

      {loadError ? (
        <div className={searchStyles.error} role="alert">
          <p>
            {status
              ? `No se pudo actualizar el estado: ${errorText(loadError)}`
              : errorText(loadError)}
          </p>
          {loadError.status === 401 ? (
            <Link to={ROUTES.login}>Iniciar sesión</Link>
          ) : null}
        </div>
      ) : null}

      {status ? (
        <div className={styles.sections}>
          {!enabled ? (
            <div className={styles.disabled} id="everything-sync-disabled">
              <p className={styles.stateTitle}>
                La integración con Everything está desactivada
              </p>
              <p className={styles.stateText}>
                Este servidor no tiene configurado el token del agente
                (EVERYTHING_AGENT_TOKEN, manual de operación), así que no se
                puede pedir una sincronización. Quien administra el servidor
                debe configurarlo para activarla.
              </p>
            </div>
          ) : null}

          <section className={styles.card} aria-labelledby="sync-last-title">
            <h2 id="sync-last-title" className={styles.cardTitle}>
              Última sincronización
            </h2>
            <LastRun run={status.lastRun} />
          </section>

          <section className={styles.card} aria-labelledby="sync-now-title">
            <h2 id="sync-now-title" className={styles.cardTitle}>
              Sincronizar ahora
            </h2>
            <div aria-live="polite">
              <CurrentRunState run={status.currentRun} />
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={searchStyles.primary}
                onClick={pressSyncNow}
                disabled={!enabled || saving || confirming}
                aria-describedby={
                  enabled ? undefined : 'everything-sync-disabled'
                }
              >
                Sincronizar ahora
              </button>
            </div>

            {confirming ? (
              <section
                className={styles.panel}
                aria-labelledby="sync-confirm-title"
              >
                <h3
                  id="sync-confirm-title"
                  ref={confirmTitle}
                  tabIndex={-1}
                  className={styles.panelTitle}
                >
                  ¿Pedir una sincronización ahora?
                </h3>
                <p className={styles.panelText}>
                  El agente del CLENA la tomará la próxima vez que pregunte a
                  Trackhive, cada minuto mientras el PC está encendido, y
                  actualizará las copias digitales del catálogo.
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={searchStyles.primary}
                    onClick={() => void confirmSyncNow()}
                    disabled={saving}
                  >
                    {saving ? 'Pidiendo…' : 'Sí, sincronizar ahora'}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setConfirming(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </section>
            ) : null}

            {notice ? (
              <div
                className={styles.notice}
                data-kind={notice.kind}
                role={notice.kind === 'success' ? 'status' : 'alert'}
              >
                <p>{notice.text}</p>
                {notice.signIn ? (
                  <Link to={ROUTES.login}>Iniciar sesión</Link>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={styles.card} aria-labelledby="sync-agent-title">
            <h2 id="sync-agent-title" className={styles.cardTitle}>
              Agente del CLENA
            </h2>
            {status.agentLastContactAt ? (
              <p className={styles.stateText}>
                Se comunicó con Trackhive por última vez{' '}
                <When iso={status.agentLastContactAt} />.
              </p>
            ) : (
              <p className={styles.stateText}>
                El agente todavía no se ha comunicado con Trackhive.
              </p>
            )}
            <p className={styles.hint}>
              Mientras el PC del CLENA está encendido, el agente pregunta cada
              minuto si hay una sincronización pedida. Si lleva mucho tiempo
              sin comunicarse, el PC puede estar apagado o sin internet.
            </p>
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}
