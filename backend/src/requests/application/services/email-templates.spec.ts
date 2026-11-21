import { REQUEST_STATUS_LABELS } from '../../domain/enums/request-status';
import {
  formatAppointmentDate,
  resolveRequestEmailTemplate,
  type StatusChangeEmailDetails,
} from './email-templates';

const TRACKING_CODE = 'SOL-2026-00042';
const FRIDAY_UTC = new Date('2026-11-20T00:00:00.000Z');
const SATURDAY_UTC = new Date('2026-11-21T00:00:00.000Z');
const WEEKDAY_HOURS = { opensAt: '08:00', closesAt: '17:00' };
const SATURDAY_HOURS = { opensAt: '09:00', closesAt: '13:00' };

const RAW_ENUM_TOKEN_PATTERN =
  /\b(RECIBIDA|EN_BUSQUEDA|DISPONIBLE|AGENDADA|ATENDIDA|CERRADA|RECHAZADA|PRESENCIAL|DIGITAL|PROTOCOLO_NOTARIAL|TEXTO_LIBRE|PROGRAMADA|CANCELADA|NO_ASISTIO)\b/;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const FILE_PATH_PATTERN = /(?:[A-Za-z]:\\|\.(?:pdf|jpg|jpeg|png|docx?)\b)/i;

describe('formatAppointmentDate', () => {
  it('formats UTC midnight dates in Spanish (es-CO) with weekday, day, month, and year', () => {
    expect(formatAppointmentDate(FRIDAY_UTC)).toBe(
      'viernes, 20 de noviembre de 2026',
    );
    expect(formatAppointmentDate(SATURDAY_UTC)).toBe(
      'sábado, 21 de noviembre de 2026',
    );
  });
});

describe('resolveRequestEmailTemplate (HU-24)', () => {
  it('maps all 7 request statuses to their own template with distinct subjects, headings, and Spanish intros', () => {
    const cases: {
      details: StatusChangeEmailDetails;
      expectedTemplate: string;
      expectedSubject: string;
      expectedHeading: string;
      expectedIntroSnippet: string;
    }[] = [
      {
        details: { newStatus: 'RECIBIDA' },
        expectedTemplate: 'SOLICITUD_RECIBIDA',
        expectedSubject: 'Recibimos su solicitud SOL-2026-00042',
        expectedHeading: 'Solicitud recibida',
        expectedIntroSnippet:
          'Recibimos su solicitud SOL-2026-00042 en el CLENA.',
      },
      {
        details: { newStatus: 'EN_BUSQUEDA' },
        expectedTemplate: 'SOLICITUD_EN_BUSQUEDA',
        expectedSubject:
          'Estamos buscando el material de su solicitud SOL-2026-00042',
        expectedHeading: 'Material en búsqueda',
        expectedIntroSnippet:
          'El personal del CLENA comenzó a buscar el material de su solicitud SOL-2026-00042.',
      },
      {
        details: { newStatus: 'DISPONIBLE' },
        expectedTemplate: 'SOLICITUD_DISPONIBLE',
        expectedSubject:
          'El material de su solicitud SOL-2026-00042 está disponible',
        expectedHeading: 'Material disponible',
        expectedIntroSnippet:
          'El material de su solicitud SOL-2026-00042 ya está disponible.',
      },
      {
        details: {
          newStatus: 'AGENDADA',
          appointment: { date: FRIDAY_UTC, serviceHours: WEEKDAY_HOURS },
        },
        expectedTemplate: 'SOLICITUD_AGENDADA',
        expectedSubject: 'Cita agendada para su solicitud SOL-2026-00042',
        expectedHeading: 'Cita agendada',
        expectedIntroSnippet:
          'El personal del CLENA agendó una cita para que consulte el material de su solicitud SOL-2026-00042',
      },
      {
        details: { newStatus: 'ATENDIDA' },
        expectedTemplate: 'SOLICITUD_ATENDIDA',
        expectedSubject: 'Su solicitud SOL-2026-00042 fue atendida',
        expectedHeading: 'Solicitud atendida',
        expectedIntroSnippet:
          'Su solicitud SOL-2026-00042 fue atendida. Registramos que realizó la consulta de su material en la sala del CLENA.',
      },
      {
        details: { newStatus: 'CERRADA' },
        expectedTemplate: 'SOLICITUD_CERRADA',
        expectedSubject: 'Su solicitud SOL-2026-00042 fue cerrada',
        expectedHeading: 'Solicitud cerrada',
        expectedIntroSnippet:
          'Su solicitud SOL-2026-00042 se ha cerrado y el trámite concluyó.',
      },
      {
        details: {
          newStatus: 'RECHAZADA',
          rejectionReason: 'El material está en restauración.',
        },
        expectedTemplate: 'SOLICITUD_RECHAZADA',
        expectedSubject: 'No fue posible atender su solicitud SOL-2026-00042',
        expectedHeading: 'Solicitud rechazada',
        expectedIntroSnippet:
          'Lamentamos informarle que su solicitud SOL-2026-00042 fue rechazada',
      },
    ];

    const subjects = new Set<string>();
    const headings = new Set<string>();
    const intros = new Set<string>();

    for (const item of cases) {
      const result = resolveRequestEmailTemplate(
        { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
        item.details,
      );

      expect(result.template).toBe(item.expectedTemplate);
      expect(result.subject).toBe(item.expectedSubject);
      expect(result.heading).toBe(item.expectedHeading);
      expect(result.intro).toContain(item.expectedIntroSnippet);
      expect(result.facts[0]).toEqual([
        'Estado actual',
        REQUEST_STATUS_LABELS[item.details.newStatus],
      ]);

      subjects.add(result.subject);
      headings.add(result.heading);
      intros.add(result.intro);
    }

    expect(subjects.size).toBe(7);
    expect(headings.size).toBe(7);
    expect(intros.size).toBe(7);
  });

  it('uses delivery-specific copy for DISPONIBLE with DIGITAL delivery mode', () => {
    const result = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'DIGITAL' },
      { newStatus: 'DISPONIBLE' },
    );

    expect(result.template).toBe('SOLICITUD_DISPONIBLE');
    expect(result.intro).toContain('copia por correo electrónico');
    expect(result.intro).not.toContain('agendará una cita');
    expect(result.facts).toEqual([
      ['Estado actual', 'Disponible'],
      ['Modo de entrega', 'Copia digital por correo'],
    ]);
  });

  it('uses delivery-specific copy for DISPONIBLE with PRESENCIAL delivery mode', () => {
    const result = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      { newStatus: 'DISPONIBLE' },
    );

    expect(result.template).toBe('SOLICITUD_DISPONIBLE');
    expect(result.intro).toContain('agendará una cita');
    expect(result.intro).not.toContain('copia por correo electrónico');
    expect(result.facts).toEqual([
      ['Estado actual', 'Disponible'],
      ['Modo de entrega', 'Consulta presencial en sala'],
    ]);
  });

  it('uses delivery-specific copy for ATENDIDA with DIGITAL vs PRESENCIAL delivery mode', () => {
    const digital = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'DIGITAL' },
      { newStatus: 'ATENDIDA' },
    );
    const presencial = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      { newStatus: 'ATENDIDA' },
    );

    expect(digital.template).toBe('SOLICITUD_ATENDIDA');
    expect(digital.intro).toContain('entrega de la copia digital');
    expect(digital.intro).toContain('correo no deseado');

    expect(presencial.template).toBe('SOLICITUD_ATENDIDA');
    expect(presencial.intro).toContain('consulta de su material en la sala');
  });

  it('includes formatted date and service hours for AGENDADA on weekdays and Saturdays', () => {
    const weekday = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      {
        newStatus: 'AGENDADA',
        appointment: { date: FRIDAY_UTC, serviceHours: WEEKDAY_HOURS },
      },
    );

    expect(weekday.template).toBe('SOLICITUD_AGENDADA');
    expect(weekday.facts).toEqual([
      ['Estado actual', 'Agendada'],
      ['Fecha de la cita', 'viernes, 20 de noviembre de 2026'],
      ['Horario de atención', 'de 8:00 a 17:00'],
    ]);

    const saturday = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      {
        newStatus: 'AGENDADA',
        appointment: { date: SATURDAY_UTC, serviceHours: SATURDAY_HOURS },
      },
    );

    expect(saturday.facts).toEqual([
      ['Estado actual', 'Agendada'],
      ['Fecha de la cita', 'sábado, 21 de noviembre de 2026'],
      ['Horario de atención', 'de 9:00 a 13:00'],
    ]);
  });

  it('uses CITA_REPROGRAMADA when appointmentEvent is REPROGRAMADA', () => {
    const result = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      {
        newStatus: 'AGENDADA',
        appointmentEvent: 'REPROGRAMADA',
        appointment: {
          date: SATURDAY_UTC,
          serviceHours: SATURDAY_HOURS,
          previousDate: FRIDAY_UTC,
        },
      },
    );

    expect(result.template).toBe('CITA_REPROGRAMADA');
    expect(result.subject).toBe(
      'Su cita de la solicitud SOL-2026-00042 fue reprogramada',
    );
    expect(result.heading).toBe('Cita reprogramada');
    expect(result.intro).toContain('se reprogramó para una nueva fecha');
    expect(result.subject).not.toContain('pasó a «Agendada»');
    expect(result.intro).not.toContain('cambió de estado');
    expect(result.facts).toEqual([
      ['Estado actual', 'Agendada'],
      ['Fecha anterior', 'viernes, 20 de noviembre de 2026'],
      ['Nueva fecha de la cita', 'sábado, 21 de noviembre de 2026'],
      ['Horario de atención', 'de 9:00 a 13:00'],
    ]);
  });

  it('omits Fecha anterior in CITA_REPROGRAMADA when previousDate is absent', () => {
    const result = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      {
        newStatus: 'AGENDADA',
        appointmentEvent: 'REPROGRAMADA',
        appointment: {
          date: SATURDAY_UTC,
          serviceHours: SATURDAY_HOURS,
        },
      },
    );

    expect(result.facts).toEqual([
      ['Estado actual', 'Agendada'],
      ['Nueva fecha de la cita', 'sábado, 21 de noviembre de 2026'],
      ['Horario de atención', 'de 9:00 a 13:00'],
    ]);
  });

  it('uses CITA_CANCELADA when appointmentEvent is CANCELADA', () => {
    const result = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      {
        newStatus: 'DISPONIBLE',
        appointmentEvent: 'CANCELADA',
        cancelledAppointmentDate: FRIDAY_UTC,
      },
    );

    expect(result.template).toBe('CITA_CANCELADA');
    expect(result.subject).toBe(
      'La cita de su solicitud SOL-2026-00042 fue cancelada',
    );
    expect(result.heading).toBe('Cita cancelada');
    expect(result.intro).toContain('se canceló');
    expect(result.intro).toContain('sigue disponible');
    expect(result.intro).toContain('agende una nueva fecha');
    expect(result.subject).not.toContain('pasó a «Disponible»');
    expect(result.facts).toEqual([
      ['Estado actual', 'Disponible'],
      ['Fecha de la cita cancelada', 'viernes, 20 de noviembre de 2026'],
    ]);
  });

  it('omits Fecha de la cita cancelada in CITA_CANCELADA when cancelledAppointmentDate is absent', () => {
    const result = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      {
        newStatus: 'DISPONIBLE',
        appointmentEvent: 'CANCELADA',
      },
    );

    expect(result.facts).toEqual([['Estado actual', 'Disponible']]);
  });

  it('uses SOLICITUD_RECHAZADA and includes Motivo del rechazo only when non-empty', () => {
    const withReason = resolveRequestEmailTemplate(
      { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
      {
        newStatus: 'RECHAZADA',
        rejectionReason: 'El material está restringido por la familia donante',
      },
    );

    expect(withReason.template).toBe('SOLICITUD_RECHAZADA');
    expect(withReason.facts).toEqual([
      ['Estado actual', 'Rechazada'],
      [
        'Motivo del rechazo',
        'El material está restringido por la familia donante',
      ],
    ]);

    for (const emptyReason of [null, undefined, '', '   ']) {
      const withoutReason = resolveRequestEmailTemplate(
        { trackingCode: TRACKING_CODE, deliveryMode: 'PRESENCIAL' },
        {
          newStatus: 'RECHAZADA',
          rejectionReason: emptyReason,
        },
      );
      expect(withoutReason.facts).toEqual([['Estado actual', 'Rechazada']]);
    }
  });

  it('never leaks raw enum tokens, ISO dates, or file paths in any of the 9 templates across both delivery modes', () => {
    const scenarios: StatusChangeEmailDetails[] = [
      { newStatus: 'RECIBIDA' },
      { newStatus: 'EN_BUSQUEDA' },
      { newStatus: 'DISPONIBLE' },
      {
        newStatus: 'AGENDADA',
        appointment: { date: FRIDAY_UTC, serviceHours: WEEKDAY_HOURS },
      },
      { newStatus: 'ATENDIDA' },
      { newStatus: 'CERRADA' },
      {
        newStatus: 'RECHAZADA',
        rejectionReason: 'El documento requiere autorización previa.',
      },
      {
        newStatus: 'AGENDADA',
        appointmentEvent: 'REPROGRAMADA',
        appointment: {
          date: SATURDAY_UTC,
          serviceHours: SATURDAY_HOURS,
          previousDate: FRIDAY_UTC,
        },
      },
      {
        newStatus: 'DISPONIBLE',
        appointmentEvent: 'CANCELADA',
        cancelledAppointmentDate: FRIDAY_UTC,
      },
    ];

    const seenTemplates = new Set<string>();

    for (const deliveryMode of ['DIGITAL', 'PRESENCIAL'] as const) {
      for (const details of scenarios) {
        const result = resolveRequestEmailTemplate(
          { trackingCode: TRACKING_CODE, deliveryMode },
          details,
        );
        seenTemplates.add(result.template);

        const stringsToCheck = [
          result.subject,
          result.heading,
          result.intro,
          ...result.facts.flatMap(([label, value]) => [label, value]),
        ];

        for (const text of stringsToCheck) {
          expect(text).not.toMatch(RAW_ENUM_TOKEN_PATTERN);
          expect(text).not.toMatch(ISO_DATE_PATTERN);
          expect(text).not.toMatch(FILE_PATH_PATTERN);
        }
      }
    }

    expect(seenTemplates.size).toBe(9);
  });
});
