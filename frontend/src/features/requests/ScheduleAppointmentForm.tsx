import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import searchStyles from '../materials/MaterialSearchPage.module.css';
import type { RequestDetail } from './api/get-request';
import { RequestsApiError } from './api/list-requests';
import { scheduleAppointment } from './api/schedule-appointment';
import type {
  Appointment,
  ScheduleAppointmentResult,
} from './api/schedule-appointment';
import detailStyles from './RequestDetailPage.module.css';
import styles from './ScheduleAppointmentForm.module.css';

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';

// Date-only text: read it at UTC noon so no time zone moves the day
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
});

/** "2026-11-20" -> "viernes 20/11/2026". */
function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const weekday = WEEKDAY_FORMAT.format(new Date(`${isoDate}T12:00:00Z`));
  return `${weekday} ${day}/${month}/${year}`;
}

/** "08:00" -> "8:00". */
function formatHour(time: string): string {
  return time.replace(/^0/, '');
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
      message: 'No tiene permiso para agendar citas.',
      sessionExpired: false,
    };
  }
  // 400 (Sunday) and 409 (not DISPONIBLE) bring a clear message from the backend
  return { message: caught.message, sessionExpired: false };
}

function Confirmation({ appointment }: { appointment: Appointment }) {
  const { opensAt, closesAt } = appointment.serviceHours;
  return (
    <div className={styles.confirmation} role="status">
      <p>
        Cita agendada para el <strong>{formatDay(appointment.date)}</strong>.{' '}
        {appointment.requester.name} puede consultar el material durante todo el
        horario de atención, de {formatHour(opensAt)} a {formatHour(closesAt)}.
      </p>
      <ul aria-label="Material de la cita">
        {appointment.materials.map((material) => (
          <li key={material.id}>
            {material.title} ({material.catalogCode})
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ScheduleAppointmentFormProps {
  request: RequestDetail;
  onScheduled: (result: ScheduleAppointmentResult) => void;
}

/**
 * «Agendar cita» action of the detail screen (HU-18). The backend state
 * machine decides when it applies: only a DISPONIBLE request with a
 * presential delivery can go to AGENDADA.
 */
export function ScheduleAppointmentForm({
  request,
  onScheduled,
}: ScheduleAppointmentFormProps) {
  // Starts on the day the requester asked for; the staff can change it
  const desiredDate = request.desiredDate.slice(0, 10);
  const [date, setDate] = useState(desiredDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  const canSchedule = request.allowedTransitions.includes('AGENDADA');
  if (!canSchedule && !appointment) {
    return null;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setError({
        message: 'Elija la fecha de la cita.',
        sessionExpired: false,
      });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await scheduleAppointment({
        requestId: request.id,
        date,
      });
      setDate('');
      setAppointment(result.appointment);
      onScheduled(result);
    } catch (caught: unknown) {
      setError(toSaveError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={detailStyles.card} aria-labelledby="sec-appointment">
      <h2 id="sec-appointment" className={detailStyles.cardTitle}>
        Agendar cita
      </h2>

      {appointment ? <Confirmation appointment={appointment} /> : null}

      {canSchedule ? (
        <form
          className={styles.form}
          onSubmit={(event) => void save(event)}
          noValidate
        >
          <div className={styles.field}>
            <label htmlFor="appointment-date">Fecha de la cita</label>
            <span id="appointment-desired-date" className={styles.hint}>
              El solicitante pidió el <strong>{formatDay(desiredDate)}</strong>.
            </span>
            <input
              id="appointment-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-describedby="appointment-desired-date appointment-date-hint"
            />
            <span id="appointment-date-hint" className={styles.hint}>
              La cita es por día, sin hora: lunes a viernes de 8:00 a 17:00 y
              sábados de 9:00 a 13:00. Los domingos no hay atención.
            </span>
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
              {saving ? 'Agendando…' : 'Agendar cita'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
