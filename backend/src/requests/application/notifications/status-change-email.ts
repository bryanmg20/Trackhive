import { escapeHtml } from '../../../common/html/escape-html';
import type { NotificationDraft } from '../../../notifications/domain/notification-draft';
import type { ServiceHours } from '../../domain/appointment-date';
import { REQUEST_STATUS_LABELS } from '../../domain/request-status';
import type { RequestStatus } from '../../domain/request-status';
import type { RequestNotificationContext } from '../ports/request.repository.port';

export interface StatusChangeEmailDetails {
  newStatus: RequestStatus;
  // Only when the change rejects the request (HU-16)
  rejectionReason?: string | null;
  // Only when the change schedules an appointment (HU-18)
  appointment?: {
    // UTC midnight of the day
    date: Date;
    serviceHours: ServiceHours;
  } | null;
}

// The appointment is a day stored as UTC midnight, so it is formatted in UTC
const APPOINTMENT_DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const ACCOUNT_HINT =
  'Si tiene una cuenta en Trackhive, también puede ver sus solicitudes en ' +
  '«Mis solicitudes».';
const SIGNATURE =
  'Este correo se envió automáticamente desde Trackhive, el sistema de ' +
  'solicitudes del CLENA.';

/**
 * The email that tells the requester that their request changed status
 * (HU-23): the new status, the material and, when it applies, the date of
 * the appointment or the reason of the rejection. Returns null when the
 * requester has no email. HU-24 will give each status its own template.
 */
export function buildStatusChangeEmail(
  context: RequestNotificationContext,
  details: StatusChangeEmailDetails,
): NotificationDraft | null {
  const recipientEmail = context.requester.email?.trim();
  if (!recipientEmail) {
    return null;
  }

  // Like the test email: first name and first last name (HU-22)
  const name = `${context.requester.firstName} ${context.requester.lastName}`;
  const status = REQUEST_STATUS_LABELS[details.newStatus];
  const facts = statusFacts(status, details);
  const materials = context.materials.map(
    ({ catalogCode, title }) => `${catalogCode} · ${title}`,
  );

  const text = [
    `Hola, ${name}:`,
    '',
    `Su solicitud ${context.trackingCode} cambió de estado.`,
    '',
    ...facts.map(([label, value]) => `${label}: ${value}`),
    '',
    'Material solicitado:',
    ...materials.map((material) => `- ${material}`),
    '',
    ACCOUNT_HINT,
    '',
    SIGNATURE,
  ].join('\n');

  // Every value can come from a person (names, titles, the reason): escaped
  const html = [
    `<p>Hola, ${toHtml(name)}:</p>`,
    `<p>Su solicitud <strong>${toHtml(context.trackingCode)}</strong> cambió de estado.</p>`,
    `<p>${facts
      .map(([label, value]) => `${label}: <strong>${toHtml(value)}</strong>`)
      .join('<br>')}</p>`,
    '<p>Material solicitado:</p>',
    `<ul>${materials.map((material) => `<li>${toHtml(material)}</li>`).join('')}</ul>`,
    `<p>${ACCOUNT_HINT}</p>`,
    `<p><small>${SIGNATURE}</small></p>`,
  ].join('\n');

  return {
    recipientEmail,
    template: 'CAMBIO_ESTADO',
    subject: `Su solicitud ${context.trackingCode} pasó a «${status}»`,
    text,
    html,
  };
}

/** The lines with the new status and what comes with it. */
function statusFacts(
  status: string,
  details: StatusChangeEmailDetails,
): [string, string][] {
  const facts: [string, string][] = [['Nuevo estado', status]];
  if (details.appointment) {
    const { date, serviceHours } = details.appointment;
    facts.push(['Fecha de la cita', APPOINTMENT_DATE_FORMAT.format(date)]);
    facts.push([
      'Horario de atención',
      `de ${hour(serviceHours.opensAt)} a ${hour(serviceHours.closesAt)}`,
    ]);
  }
  if (details.rejectionReason) {
    facts.push(['Motivo del rechazo', details.rejectionReason]);
  }
  return facts;
}

// 08:00 -> 8:00
function hour(value: string): string {
  return value.replace(/^0(\d)/, '$1');
}

function toHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}
