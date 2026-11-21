import type { NotificationTemplate } from '../../../notifications/domain/enums/notification-template';
import type { DeliveryMode } from '../../domain/enums/delivery-mode';
import { REQUEST_STATUS_LABELS } from '../../domain/enums/request-status';
import type { RequestStatus } from '../../domain/enums/request-status';
import type { ServiceHours } from '../../domain/value-objects/appointment-date';
import type { RequestNotificationContext } from '../ports/request-query.port';

export type AppointmentEmailEvent = 'REPROGRAMADA' | 'CANCELADA';

export interface StatusChangeEmailDetails {
  newStatus: RequestStatus;
  // Optional staff comment for the requester (HU-24)
  comment?: string | null;
  // Only when the change rejects the request (HU-16)
  rejectionReason?: string | null;
  // Only for HU-21 appointment reschedule/cancel events
  appointmentEvent?: AppointmentEmailEvent;
  // Scheduled or rescheduled appointment (HU-18, HU-21)
  appointment?: {
    // UTC midnight of the day
    date: Date;
    serviceHours: ServiceHours;
    // Previous appointment day when rescheduled (HU-21); UTC midnight
    previousDate?: Date;
  } | null;
  // Cancelled appointment day when cancelled (HU-21); UTC midnight
  cancelledAppointmentDate?: Date | null;
}

export interface EmailTemplateContent {
  readonly template: NotificationTemplate;
  readonly subject: string;
  readonly heading: string;
  readonly intro: string;
  readonly facts: readonly (readonly [string, string])[];
}

// Appointment dates are stored as UTC midnight, so they are formatted in UTC
const APPOINTMENT_DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const DELIVERY_MODE_FACT_LABELS: Record<DeliveryMode, string> = {
  DIGITAL: 'Copia digital por correo',
  PRESENCIAL: 'Consulta presencial en sala',
};

/** Formats a UTC-midnight appointment date in Spanish (Colombia). */
export function formatAppointmentDate(date: Date): string {
  return APPOINTMENT_DATE_FORMAT.format(date);
}

/**
 * Resolves the HU-24 Spanish email template, subject, heading, intro, and
 * structured facts for a request status change or appointment event.
 */
export function resolveRequestEmailTemplate(
  context: Pick<RequestNotificationContext, 'trackingCode' | 'deliveryMode'>,
  details: StatusChangeEmailDetails,
): EmailTemplateContent {
  const { trackingCode: code, deliveryMode } = context;
  const facts: [string, string][] = [
    ['Estado actual', REQUEST_STATUS_LABELS[details.newStatus]],
  ];

  if (details.appointmentEvent === 'REPROGRAMADA') {
    return buildRescheduledContent(code, facts, details.appointment);
  }

  if (details.appointmentEvent === 'CANCELADA') {
    return buildCancelledContent(code, facts, details.cancelledAppointmentDate);
  }

  switch (details.newStatus) {
    case 'RECIBIDA':
      return {
        template: 'SOLICITUD_RECIBIDA',
        subject: `Recibimos su solicitud ${code}`,
        heading: 'Solicitud recibida',
        intro: `Recibimos su solicitud ${code} en el CLENA. Nuestro equipo revisará su pedido y le avisaremos cuando comience la búsqueda del material.`,
        facts,
      };

    case 'EN_BUSQUEDA':
      return {
        template: 'SOLICITUD_EN_BUSQUEDA',
        subject: `Estamos buscando el material de su solicitud ${code}`,
        heading: 'Material en búsqueda',
        intro: `El personal del CLENA comenzó a buscar el material de su solicitud ${code}. Le avisaremos por este medio en cuanto esté disponible.`,
        facts,
      };

    case 'DISPONIBLE':
      facts.push(['Modo de entrega', DELIVERY_MODE_FACT_LABELS[deliveryMode]]);
      return {
        template: 'SOLICITUD_DISPONIBLE',
        subject: `El material de su solicitud ${code} está disponible`,
        heading: 'Material disponible',
        intro:
          deliveryMode === 'DIGITAL'
            ? `El material de su solicitud ${code} ya está disponible. Como eligió entrega digital, el personal del CLENA le enviará la copia por correo electrónico.`
            : `El material de su solicitud ${code} ya está disponible. Como eligió consulta presencial, el personal del CLENA agendará una cita para que pueda revisarlo en la sala de consulta y le enviará la fecha por correo.`,
        facts,
      };

    case 'AGENDADA':
      if (details.appointment) {
        facts.push([
          'Fecha de la cita',
          formatAppointmentDate(details.appointment.date),
        ]);
        facts.push([
          'Horario de atención',
          formatServiceHours(details.appointment.serviceHours),
        ]);
      }
      return {
        template: 'SOLICITUD_AGENDADA',
        subject: `Cita agendada para su solicitud ${code}`,
        heading: 'Cita agendada',
        intro: `El personal del CLENA agendó una cita para que consulte el material de su solicitud ${code} en la sala de consulta. Puede acercarse en cualquier momento durante el horario de atención de ese día.`,
        facts,
      };

    case 'ATENDIDA':
      return {
        template: 'SOLICITUD_ATENDIDA',
        subject: `Su solicitud ${code} fue atendida`,
        heading: 'Solicitud atendida',
        intro:
          deliveryMode === 'DIGITAL'
            ? `Su solicitud ${code} fue atendida. La entrega de la copia digital se ha registrado; si aún no la ve en su bandeja de entrada, revise también la carpeta de correo no deseado.`
            : `Su solicitud ${code} fue atendida. Registramos que realizó la consulta de su material en la sala del CLENA.`,
        facts,
      };

    case 'CERRADA':
      return {
        template: 'SOLICITUD_CERRADA',
        subject: `Su solicitud ${code} fue cerrada`,
        heading: 'Solicitud cerrada',
        intro: `Su solicitud ${code} se ha cerrado y el trámite concluyó. Si necesita consultar otro material, puede radicar una nueva solicitud cuando lo desee.`,
        facts,
      };

    case 'RECHAZADA': {
      const reason = details.rejectionReason?.trim();
      if (reason) {
        facts.push(['Motivo del rechazo', reason]);
      }
      return {
        template: 'SOLICITUD_RECHAZADA',
        subject: `No fue posible atender su solicitud ${code}`,
        heading: 'Solicitud rechazada',
        intro: `Lamentamos informarle que su solicitud ${code} fue rechazada y no podrá continuar en trámite.`,
        facts,
      };
    }
  }
}

function buildRescheduledContent(
  code: string,
  facts: [string, string][],
  appointment: StatusChangeEmailDetails['appointment'],
): EmailTemplateContent {
  if (appointment?.previousDate) {
    facts.push([
      'Fecha anterior',
      formatAppointmentDate(appointment.previousDate),
    ]);
  }
  if (appointment) {
    facts.push([
      'Nueva fecha de la cita',
      formatAppointmentDate(appointment.date),
    ]);
    facts.push([
      'Horario de atención',
      formatServiceHours(appointment.serviceHours),
    ]);
  }
  return {
    template: 'CITA_REPROGRAMADA',
    subject: `Su cita de la solicitud ${code} fue reprogramada`,
    heading: 'Cita reprogramada',
    intro: `La cita de consulta de su solicitud ${code} se reprogramó para una nueva fecha. Puede acercarse en cualquier momento durante el horario de atención del nuevo día.`,
    facts,
  };
}

function buildCancelledContent(
  code: string,
  facts: [string, string][],
  cancelledAppointmentDate: Date | null | undefined,
): EmailTemplateContent {
  if (cancelledAppointmentDate) {
    facts.push([
      'Fecha de la cita cancelada',
      formatAppointmentDate(cancelledAppointmentDate),
    ]);
  }
  return {
    template: 'CITA_CANCELADA',
    subject: `La cita de su solicitud ${code} fue cancelada`,
    heading: 'Cita cancelada',
    intro: `La cita de consulta de su solicitud ${code} se canceló. Su solicitud sigue disponible para que el personal del CLENA agende una nueva fecha.`,
    facts,
  };
}

function formatServiceHours(hours: ServiceHours): string {
  return `de ${formatHour(hours.opensAt)} a ${formatHour(hours.closesAt)}`;
}

// 08:00 -> 8:00
function formatHour(value: string): string {
  return value.replace(/^0(\d)/, '$1');
}
