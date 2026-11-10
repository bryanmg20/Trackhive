export const APPOINTMENT_STATUSES = [
  'PROGRAMADA',
  'CUMPLIDA',
  'CANCELADA',
  'NO_ASISTIO',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}
