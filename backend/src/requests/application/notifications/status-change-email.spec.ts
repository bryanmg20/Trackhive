import type { RequestNotificationContext } from '../ports/request.repository.port';
import { buildStatusChangeEmail } from './status-change-email';

const CONTEXT: RequestNotificationContext = {
  trackingCode: 'SOL-2026-00042',
  requester: {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@example.com',
  },
  materials: [
    { catalogCode: 'AHB-001', title: 'Actas del concejo de 1890' },
    { catalogCode: 'AHB-002', title: 'El Heraldo, 1935' },
  ],
};

describe('buildStatusChangeEmail (HU-23)', () => {
  it('goes to the requester with the tracking code and the new status in the subject', () => {
    const email = buildStatusChangeEmail(CONTEXT, { newStatus: 'EN_BUSQUEDA' });

    expect(email).toMatchObject({
      recipientEmail: 'juan@example.com',
      template: 'CAMBIO_ESTADO',
      subject: 'Su solicitud SOL-2026-00042 pasó a «En búsqueda»',
    });
  });

  it('tells the new status and every material, in text and in HTML', () => {
    const email = buildStatusChangeEmail(CONTEXT, { newStatus: 'DISPONIBLE' });

    expect(email?.text).toContain('Hola, Juan Pérez:');
    expect(email?.text).toContain(
      'Su solicitud SOL-2026-00042 cambió de estado.',
    );
    expect(email?.text).toContain('Nuevo estado: Disponible');
    expect(email?.text).toContain('- AHB-001 · Actas del concejo de 1890');
    expect(email?.text).toContain('- AHB-002 · El Heraldo, 1935');
    expect(email?.html).toContain('Nuevo estado: <strong>Disponible</strong>');
    expect(email?.html).toContain(
      '<li>AHB-001 · Actas del concejo de 1890</li>',
    );
  });

  it('adds the day and the service hours of the appointment when it is scheduled', () => {
    const email = buildStatusChangeEmail(CONTEXT, {
      newStatus: 'AGENDADA',
      appointment: {
        date: new Date('2026-11-20T00:00:00.000Z'),
        serviceHours: { opensAt: '08:00', closesAt: '17:00' },
      },
    });

    expect(email?.text).toContain('Nuevo estado: Agendada');
    expect(email?.text).toContain(
      'Fecha de la cita: viernes, 20 de noviembre de 2026',
    );
    expect(email?.text).toContain('Horario de atención: de 8:00 a 17:00');
  });

  it('adds the reason when the request is rejected', () => {
    const email = buildStatusChangeEmail(CONTEXT, {
      newStatus: 'RECHAZADA',
      rejectionReason: 'El material está restringido por la familia donante',
    });

    expect(email?.text).toContain('Nuevo estado: Rechazada');
    expect(email?.text).toContain(
      'Motivo del rechazo: El material está restringido por la familia donante',
    );
  });

  it.each(['EN_BUSQUEDA', 'DISPONIBLE', 'ATENDIDA', 'CERRADA'] as const)(
    'has neither appointment nor reason for %s',
    (newStatus) => {
      const email = buildStatusChangeEmail(CONTEXT, { newStatus });

      expect(email?.text).not.toContain('Fecha de la cita');
      expect(email?.text).not.toContain('Motivo del rechazo');
    },
  );

  it('escapes what a person wrote, so it cannot inject HTML', () => {
    const email = buildStatusChangeEmail(
      {
        ...CONTEXT,
        requester: { ...CONTEXT.requester, firstName: '<b>Juan</b>' },
        materials: [{ catalogCode: 'AHB-001', title: 'Actas <script>' }],
      },
      { newStatus: 'RECHAZADA', rejectionReason: 'Fuera de "alcance" & más' },
    );

    expect(email?.html).toContain('Hola, &lt;b&gt;Juan&lt;/b&gt; Pérez:');
    expect(email?.html).toContain('Actas &lt;script&gt;');
    expect(email?.html).toContain('Fuera de &quot;alcance&quot; &amp; más');
    expect(email?.html).not.toContain('<script>');
    // The text version stays as it was written
    expect(email?.text).toContain('Actas <script>');
  });

  it('keeps the line breaks of the reason in the HTML', () => {
    const email = buildStatusChangeEmail(CONTEXT, {
      newStatus: 'RECHAZADA',
      rejectionReason: 'Primera línea\nSegunda línea',
    });

    expect(email?.html).toContain('Primera línea<br>Segunda línea');
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
