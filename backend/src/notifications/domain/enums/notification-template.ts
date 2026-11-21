/** Kinds of email of the outbox (CHECK in the migration). */
export const NOTIFICATION_TEMPLATES = [
  'SOLICITUD_RECIBIDA',
  'SOLICITUD_EN_BUSQUEDA',
  'SOLICITUD_DISPONIBLE',
  'SOLICITUD_AGENDADA',
  'SOLICITUD_ATENDIDA',
  'SOLICITUD_CERRADA',
  'SOLICITUD_RECHAZADA',
  'CITA_REPROGRAMADA',
  'CITA_CANCELADA',
] as const;

export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

export function isNotificationTemplate(
  value: string,
): value is NotificationTemplate {
  return (NOTIFICATION_TEMPLATES as readonly string[]).includes(value);
}
