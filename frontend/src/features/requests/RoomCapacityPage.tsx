import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import { RequestsApiError } from './api/list-requests';
import {
  getRoomCapacity,
  updateRoomCapacity,
} from './api/room-capacity';
import type { RoomCapacityConfig } from './api/room-capacity';
import scheduleStyles from './ScheduleAppointmentForm.module.css';
import styles from './RoomCapacityPage.module.css';

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

const UPDATED_AT_FORMAT = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

interface PageError {
  message: string;
  sessionExpired: boolean;
}

function toPageError(caught: unknown): PageError {
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
      message: 'Solo un administrador puede configurar la capacidad de la sala.',
      sessionExpired: false,
    };
  }
  return { message: caught.message, sessionExpired: false };
}

function parsePositiveInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 2147483647) {
    return null;
  }
  return parsed;
}

/**
 * Administrator screen (HU-20.1, WF-13): displays the current daily capacity
 * of the reading room (default 15) and lets an ADMIN update it.
 */
export function RoomCapacityPage() {
  const [config, setConfig] = useState<RoomCapacityConfig | null>(null);
  const [capacityInput, setCapacityInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<PageError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<PageError | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getRoomCapacity()
      .then((loaded) => {
        if (ignore) return;
        setConfig(loaded);
        setCapacityInput(String(loaded.dailyCapacity));
        setLoadError(null);
      })
      .catch((caught: unknown) => {
        if (ignore) return;
        setLoadError(toPageError(caught));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parsePositiveInteger(capacityInput);
    if (parsed === null) {
      setConfirmation(null);
      setSaveError({
        message: 'Ingrese un número entero mayor que 0.',
        sessionExpired: false,
      });
      return;
    }

    setSaving(true);
    setSaveError(null);
    setConfirmation(null);
    try {
      const updated = await updateRoomCapacity(parsed);
      setConfig(updated);
      setCapacityInput(String(updated.dailyCapacity));
      setConfirmation(
        `Capacidad diaria actualizada a ${updated.dailyCapacity} ` +
          `${updated.dailyCapacity === 1 ? 'cita' : 'citas'} por día.`,
      );
    } catch (caught: unknown) {
      setSaveError(toPageError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <section className={searchStyles.hero} aria-labelledby="room-capacity-title">
        <p className={searchStyles.eyebrow}>Administración de sala</p>
        <h1 id="room-capacity-title" className={searchStyles.title}>
          Capacidad de la sala
        </h1>
        <p className={styles.note}>
          Configure el límite diario de citas de la sala de consulta.
        </p>
      </section>

      <div className={styles.sections}>
        <section className={styles.card} aria-labelledby="sec-current-capacity">
          <h2 id="sec-current-capacity" className={styles.cardTitle}>
            Capacidad diaria vigente
          </h2>

          {loading ? <p className={searchStyles.muted}>Cargando…</p> : null}

          {loadError ? (
            <div className={searchStyles.error} role="alert">
              <p>{loadError.message}</p>
              {loadError.sessionExpired ? (
                <Link to={ROUTES.login}>Iniciar sesión</Link>
              ) : null}
            </div>
          ) : null}

          {config ? (
            <>
              <div className={styles.summaryRow}>
                <span className={styles.currentValue}>
                  {config.dailyCapacity}{' '}
                  {config.dailyCapacity === 1 ? 'cita / día' : 'citas / día'}
                </span>
                <span className={styles.currentMeta}>
                  {config.isDefault
                    ? 'Valor por defecto (sin configuración personalizada)'
                    : `Última actualización: ${
                        config.updatedAt
                          ? UPDATED_AT_FORMAT.format(new Date(config.updatedAt))
                          : 'guardada'
                      }${config.updatedBy ? ` por ${config.updatedBy.name}` : ''}`}
                </span>
              </div>

              {confirmation ? (
                <div className={scheduleStyles.confirmation} role="status">
                  <p>{confirmation}</p>
                </div>
              ) : null}

              <form
                className={styles.form}
                onSubmit={(event) => void save(event)}
                noValidate
              >
                <div className={styles.field}>
                  <label htmlFor="daily-capacity-input">
                    Capacidad diaria (entero mayor que 0)
                  </label>
                  <input
                    id="daily-capacity-input"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={capacityInput}
                    onChange={(event) => setCapacityInput(event.target.value)}
                    aria-describedby="daily-capacity-hint"
                  />
                  <span id="daily-capacity-hint" className={scheduleStyles.hint}>
                    Se aplica a las citas nuevas desde el momento en que se
                    guarda.
                  </span>
                </div>

                {saveError ? (
                  <div className={searchStyles.error} role="alert">
                    <p>{saveError.message}</p>
                    {saveError.sessionExpired ? (
                      <Link to={ROUTES.login}>Iniciar sesión</Link>
                    ) : null}
                  </div>
                ) : null}

                <div className={styles.actions}>
                  <button
                    className={searchStyles.primary}
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? 'Guardando…' : 'Guardar capacidad'}
                  </button>
                  <Link className={styles.secondaryLink} to={ROUTES.calendar}>
                    Ver calendario
                  </Link>
                </div>
              </form>
            </>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="sec-capacity-rules">
          <h2 id="sec-capacity-rules" className={styles.cardTitle}>
            Reglas de aplicación
          </h2>
          <p className={styles.note}>
            Si reduce la capacidad por debajo de las reservas ya existentes en un
            día, esas citas se conservan intactas y no se cancelan; únicamente se
            impiden nuevas citas en los días que ya igualen o superen el límite.
            Las citas canceladas o marcadas por inasistencia liberan el cupo.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
