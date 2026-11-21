import type { RequestNotificationContext } from '../ports/request-query.port';
import {
  buildStatusChangeEmail,
  type StatusChangeEmailDetails,
} from './status-change-email';

const FRIDAY_UTC = new Date('2026-11-20T00:00:00.000Z');
const SATURDAY_UTC = new Date('2026-11-21T00:00:00.000Z');
const WEEKDAY_HOURS = { opensAt: '08:00', closesAt: '17:00' };
const SATURDAY_HOURS = { opensAt: '09:00', closesAt: '13:00' };
const FILE_PATH_PATTERN = /(?:[A-Za-z]:\\|\.(?:pdf|jpg|jpeg|png|docx?)\b)/i;

const CONTEXT: RequestNotificationContext = {
  trackingCode: 'SOL-2026-00042',
  deliveryMode: 'PRESENCIAL',
  requester: {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@example.com',
  },
  materials: [
    { catalogCode: 'AHB-001', title: 'Actas del concejo de 1890' },
    { catalogCode: 'AHB-002', title: 'El Heraldo, 1935' },
  ],
  references: [],
};

describe('buildStatusChangeEmail (HU-24)', () => {
  it.each<{
    details: StatusChangeEmailDetails;
    template: string;
    subject: string;
    heading: string;
    intro: string;
    statusLabel: string;
  }>([
    {
      details: { newStatus: 'RECIBIDA' },
      template: 'SOLICITUD_RECIBIDA',
      subject: 'Recibimos su solicitud SOL-2026-00042',
      heading: 'Solicitud recibida',
      intro: 'Recibimos su solicitud SOL-2026-00042 en el CLENA.',
      statusLabel: 'Recibida',
    },
    {
      details: { newStatus: 'EN_BUSQUEDA' },
      template: 'SOLICITUD_EN_BUSQUEDA',
      subject: 'Estamos buscando el material de su solicitud SOL-2026-00042',
      heading: 'Material en búsqueda',
      intro:
        'El personal del CLENA comenzó a buscar el material de su solicitud SOL-2026-00042.',
      statusLabel: 'En búsqueda',
    },
    {
      details: { newStatus: 'DISPONIBLE' },
      template: 'SOLICITUD_DISPONIBLE',
      subject: 'El material de su solicitud SOL-2026-00042 está disponible',
      heading: 'Material disponible',
      intro: 'El material de su solicitud SOL-2026-00042 ya está disponible.',
      statusLabel: 'Disponible',
    },
    {
      details: {
        newStatus: 'AGENDADA',
        appointment: { date: FRIDAY_UTC, serviceHours: WEEKDAY_HOURS },
      },
      template: 'SOLICITUD_AGENDADA',
      subject: 'Cita agendada para su solicitud SOL-2026-00042',
      heading: 'Cita agendada',
      intro:
        'El personal del CLENA agendó una cita para que consulte el material de su solicitud SOL-2026-00042 en la sala de consulta.',
      statusLabel: 'Agendada',
    },
    {
      details: { newStatus: 'ATENDIDA' },
      template: 'SOLICITUD_ATENDIDA',
      subject: 'Su solicitud SOL-2026-00042 fue atendida',
      heading: 'Solicitud atendida',
      intro: 'Su solicitud SOL-2026-00042 fue atendida.',
      statusLabel: 'Atendida',
    },
    {
      details: { newStatus: 'CERRADA' },
      template: 'SOLICITUD_CERRADA',
      subject: 'Su solicitud SOL-2026-00042 fue cerrada',
      heading: 'Solicitud cerrada',
      intro: 'Su solicitud SOL-2026-00042 se ha cerrado y el trámite concluyó.',
      statusLabel: 'Cerrada',
    },
    {
      details: {
        newStatus: 'RECHAZADA',
        rejectionReason: 'El material está restringido por la familia donante',
      },
      template: 'SOLICITUD_RECHAZADA',
      subject: 'No fue posible atender su solicitud SOL-2026-00042',
      heading: 'Solicitud rechazada',
      intro:
        'Lamentamos informarle que su solicitud SOL-2026-00042 fue rechazada',
      statusLabel: 'Rechazada',
    },
  ])(
    'uses dedicated template $template, subject, heading, and intro in text and HTML',
    ({ details, template, subject, heading, intro, statusLabel }) => {
      const email = buildStatusChangeEmail(CONTEXT, details);

      expect(email).toMatchObject({
        recipientEmail: 'juan@example.com',
        template,
        subject,
      });
      expect(email?.text).toContain('Hola, Juan Pérez:');
      expect(email?.text).toContain(intro);
      expect(email?.text).toContain(`Estado actual: ${statusLabel}`);
      expect(email?.text).toContain('- AHB-001 · Actas del concejo de 1890');
      expect(email?.text).toContain('- AHB-002 · El Heraldo, 1935');

      expect(email?.html).toContain('CLENA · Trackhive');
      expect(email?.html).toContain(heading);
      expect(email?.html).toContain('Hola, Juan Pérez:');
      expect(email?.html).toContain(intro);
      expect(email?.html).toContain(
        `Estado actual: <strong>${statusLabel}</strong>`,
      );
      expect(email?.html).toContain(
        '<li>AHB-001 · Actas del concejo de 1890</li>',
      );
      expect(email?.html).toContain('<hr');
      expect(email?.html).toContain('<small>');
    },
  );

  it('changes DISPONIBLE copy between DIGITAL and PRESENCIAL and never leaks any file path or filename', () => {
    const digital = buildStatusChangeEmail(
      { ...CONTEXT, deliveryMode: 'DIGITAL' },
      { newStatus: 'DISPONIBLE' },
    );
    const presencial = buildStatusChangeEmail(
      { ...CONTEXT, deliveryMode: 'PRESENCIAL' },
      { newStatus: 'DISPONIBLE' },
    );

    expect(digital?.template).toBe('SOLICITUD_DISPONIBLE');
    expect(digital?.text).toContain('copia por correo electrónico');
    expect(digital?.text).toContain(
      'Modo de entrega: Copia digital por correo',
    );
    expect(digital?.text).not.toContain('agendará una cita');
    expect(digital?.html).toContain('copia por correo electrónico');
    expect(digital?.text).not.toMatch(FILE_PATH_PATTERN);
    expect(digital?.html).not.toMatch(FILE_PATH_PATTERN);

    expect(presencial?.template).toBe('SOLICITUD_DISPONIBLE');
    expect(presencial?.text).toContain('agendará una cita');
    expect(presencial?.text).toContain(
      'Modo de entrega: Consulta presencial en sala',
    );
    expect(presencial?.text).not.toContain('copia por correo electrónico');
    expect(presencial?.html).toContain('agendará una cita');
  });

  it('adds appointment date and service hours in text and HTML when scheduled', () => {
    const email = buildStatusChangeEmail(CONTEXT, {
      newStatus: 'AGENDADA',
      appointment: { date: FRIDAY_UTC, serviceHours: WEEKDAY_HOURS },
    });

    expect(email?.text).toContain(
      'Fecha de la cita: viernes, 20 de noviembre de 2026',
    );
    expect(email?.text).toContain('Horario de atención: de 8:00 a 17:00');
    expect(email?.html).toContain(
      'Fecha de la cita: <strong>viernes, 20 de noviembre de 2026</strong>',
    );
    expect(email?.html).toContain(
      'Horario de atención: <strong>de 8:00 a 17:00</strong>',
    );
  });

  it('renders staff comment under Observaciones del personal across status changes, rescheduling, and cancellation', () => {
    const scenarios: StatusChangeEmailDetails[] = [
      { newStatus: 'EN_BUSQUEDA', comment: 'Se revisó el tomo 3' },
      {
        newStatus: 'AGENDADA',
        appointmentEvent: 'REPROGRAMADA',
        appointment: {
          date: SATURDAY_UTC,
          serviceHours: SATURDAY_HOURS,
          previousDate: FRIDAY_UTC,
        },
        comment: 'Se revisó el tomo 3',
      },
      {
        newStatus: 'DISPONIBLE',
        appointmentEvent: 'CANCELADA',
        cancelledAppointmentDate: FRIDAY_UTC,
        comment: 'Se revisó el tomo 3',
      },
    ];

    for (const details of scenarios) {
      const email = buildStatusChangeEmail(CONTEXT, details);

      expect(email?.text).toContain(
        'Observaciones del personal:\nSe revisó el tomo 3',
      );
      expect(email?.html).toContain('Observaciones del personal:');
      expect(email?.html).toContain('Se revisó el tomo 3');
    }
  });

  it.each([undefined, null, '', '   \n\t  '])(
    'omits Observaciones del personal completely when comment is %j',
    (comment) => {
      const email = buildStatusChangeEmail(CONTEXT, {
        newStatus: 'DISPONIBLE',
        comment,
      });

      expect(email?.text).not.toContain('Observaciones del personal');
      expect(email?.html).not.toContain('Observaciones del personal');
    },
  );

  it('shows Motivo del rechazo once on RECHAZADA and omits Observaciones del personal even when comment has the same text', () => {
    const email = buildStatusChangeEmail(CONTEXT, {
      newStatus: 'RECHAZADA',
      rejectionReason: 'El material está restringido por la familia donante',
      comment: '  El material está restringido por la familia donante  ',
    });

    expect(email?.text).toContain(
      'Motivo del rechazo: El material está restringido por la familia donante',
    );
    expect(email?.html).toContain(
      'Motivo del rechazo: <strong>El material está restringido por la familia donante</strong>',
    );
    expect(email?.text).not.toContain('Observaciones del personal');
    expect(email?.html).not.toContain('Observaciones del personal');
  });

  it('escapes HTML and keeps line breaks for requester name, catalog title, written references, rejection reason, and staff comment', () => {
    const rejected = buildStatusChangeEmail(
      {
        ...CONTEXT,
        requester: { ...CONTEXT.requester, firstName: '<b>Juan</b>' },
        materials: [{ catalogCode: 'AHB-001', title: 'Actas <script>' }],
        references: ['Escritura "57" & anexo\nNotaría <1>'],
      },
      {
        newStatus: 'RECHAZADA',
        rejectionReason: 'Fuera de "alcance" & más\nSegunda línea',
      },
    );

    expect(rejected?.html).toContain('Hola, &lt;b&gt;Juan&lt;/b&gt; Pérez:');
    expect(rejected?.html).toContain('AHB-001 · Actas &lt;script&gt;');
    expect(rejected?.html).toContain(
      '<li>Escritura &quot;57&quot; &amp; anexo<br>Notaría &lt;1&gt;</li>',
    );
    expect(rejected?.html).toContain(
      'Fuera de &quot;alcance&quot; &amp; más<br>Segunda línea',
    );
    expect(rejected?.html).not.toContain('<script>');
    expect(rejected?.html).not.toContain('<b>');
    // Plain text preserves raw characters
    expect(rejected?.text).toContain('Actas <script>');
    expect(rejected?.text).toContain('Escritura "57" & anexo\nNotaría <1>');
    expect(rejected?.text).toContain('Fuera de "alcance" & más\nSegunda línea');

    const withComment = buildStatusChangeEmail(CONTEXT, {
      newStatus: 'DISPONIBLE',
      comment: 'Revisar <b>tomo</b> & <script>alert(1)</script> "ya"\nNota 2',
    });

    expect(withComment?.html).toContain(
      'Revisar &lt;b&gt;tomo&lt;/b&gt; &amp; &lt;script&gt;alert(1)&lt;/script&gt; &quot;ya&quot;<br>Nota 2',
    );
    expect(withComment?.html).not.toContain('<script>');
    expect(withComment?.html).not.toContain('<b>');
    expect(withComment?.text).toContain(
      'Revisar <b>tomo</b> & <script>alert(1)</script> "ya"\nNota 2',
    );
  });

  it('combines catalog materials and pending written references, and supports reference-only requests', () => {
    const combined = buildStatusChangeEmail(
      {
        ...CONTEXT,
        references: ['Escritura 57 de 1940, Notaría Primera'],
      },
      { newStatus: 'EN_BUSQUEDA' },
    );

    expect(combined?.text).toContain('- AHB-001 · Actas del concejo de 1890');
    expect(combined?.text).toContain('- AHB-002 · El Heraldo, 1935');
    expect(combined?.text).toContain('- Escritura 57 de 1940, Notaría Primera');
    expect(combined?.html).toContain(
      '<li>Escritura 57 de 1940, Notaría Primera</li>',
    );

    const referenceOnly = buildStatusChangeEmail(
      {
        ...CONTEXT,
        materials: [],
        references: ['Escritura 57 de 1940, Notaría Primera'],
      },
      { newStatus: 'DISPONIBLE' },
    );

    expect(referenceOnly?.text).toContain('Material solicitado:');
    expect(referenceOnly?.text).toContain(
      '- Escritura 57 de 1940, Notaría Primera',
    );
    expect(referenceOnly?.html).toContain(
      '<li>Escritura 57 de 1940, Notaría Primera</li>',
    );

    const emptyMaterials = buildStatusChangeEmail(
      { ...CONTEXT, materials: [], references: [] },
      { newStatus: 'EN_BUSQUEDA' },
    );

    expect(emptyMaterials?.text).not.toContain('Material solicitado');
    expect(emptyMaterials?.html).not.toContain('Material solicitado');
  });

  it('trims the email of the requester', () => {
    const email = buildStatusChangeEmail(
      {
        ...CONTEXT,
        requester: { ...CONTEXT.requester, email: '  juan@example.com ' },
      },
      { newStatus: 'CERRADA' },
    );

    expect(email?.recipientEmail).toBe('juan@example.com');
  });

  it.each([null, '', '   '])(
    'returns null when the requester has no email (%j)',
    (email) => {
      expect(
        buildStatusChangeEmail(
          { ...CONTEXT, requester: { ...CONTEXT.requester, email } },
          { newStatus: 'CERRADA' },
        ),
      ).toBeNull();
    },
  );
});
