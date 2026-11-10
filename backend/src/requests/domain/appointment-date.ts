import { InvalidAppointmentDateError } from './errors/invalid-appointment-date.error';

/** Opening and closing time of a day, as HH:mm in America/Bogota. */
export interface ServiceHours {
  opensAt: string;
  closesAt: string;
}

const WEEKDAY_HOURS: ServiceHours = { opensAt: '08:00', closesAt: '17:00' };
const SATURDAY_HOURS: ServiceHours = { opensAt: '09:00', closesAt: '13:00' };

/**
 * Service hours of the CLENA by day of the week (0 = Sunday). An appointment
 * has no time: the requester can consult the material during all the service
 * hours of the day (HU-18). There is no service on Sunday.
 */
const SERVICE_HOURS: readonly (ServiceHours | null)[] = [
  null,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  SATURDAY_HOURS,
];

export interface AppointmentDay {
  // UTC midnight of the day, for the date-only column
  date: Date;
  serviceHours: ServiceHours;
}

/**
 * Validates the day of an appointment: a real YYYY-MM-DD date on which the
 * CLENA attends (Monday to Saturday). Returns the day and its service hours.
 */
export function toAppointmentDay(value: string): AppointmentDay {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new InvalidAppointmentDateError(
      'La fecha de la cita no tiene un formato válido.',
    );
  }

  const serviceHours = SERVICE_HOURS[date.getUTCDay()];
  if (!serviceHours) {
    throw new InvalidAppointmentDateError(
      'El CLENA no atiende los domingos. Elija una fecha de lunes a sábado.',
    );
  }
  return { date, serviceHours };
}
