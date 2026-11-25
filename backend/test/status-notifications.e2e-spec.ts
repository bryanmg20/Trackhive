import { USER_REPOSITORY } from '../src/users/application/tokens';
import { INestApplication, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import {
  MAIL_SENDER,
  NOTIFICATION_QUEUE,
} from '../src/notifications/application/tokens';
import { SendPendingNotificationsUseCase } from '../src/notifications/application/use-cases/send-pending-notifications.use-case';
import type { NotificationTemplate } from '../src/notifications/domain/enums/notification-template';
import type { NotificationDraft } from '../src/notifications/domain/value-objects/notification-draft';
import { SendPendingNotificationsJob } from '../src/notifications/infrastructure/jobs/send-pending-notifications.job';
import { PrismaService } from '../src/prisma/prisma.service';
import type { RequestNotificationContext } from '../src/requests/application/ports/request-query.port';
import {
  REQUEST_QUERY_SERVICE,
  REQUEST_REPOSITORY,
  ROOM_CAPACITY_REPOSITORY,
} from '../src/requests/application/tokens';
import { Request } from '../src/requests/domain/entities/request.entity';
import type { DeliveryMode } from '../src/requests/domain/enums/delivery-mode';
import type { RequestStatus } from '../src/requests/domain/enums/request-status';
import type { SavedStatusChange } from '../src/requests/domain/value-objects/saved-status-change';
import type { StatusChange } from '../src/requests/domain/value-objects/status-change';
import { FakeMailSender } from './fakes/fake-mail-sender';
import { InMemoryNotificationQueue } from './fakes/in-memory-notification.queue';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const REQUEST_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';
const APPOINTMENT_ID = '7b4d3f1c-2a9e-4c1a-9e2f-1a2b3c4d5e6f';
const STATUS_PATH = `/api/v1/requests/${REQUEST_ID}/status`;
const APPOINTMENTS_PATH = `/api/v1/requests/${REQUEST_ID}/appointments`;
const RESCHEDULE_PATH = `/api/v1/appointments/${APPOINTMENT_ID}/reschedule`;
const CANCEL_PATH = `/api/v1/appointments/${APPOINTMENT_ID}/cancel`;
// 2026-11-20 is Friday, 2026-11-21 is Saturday, 2026-11-23 is Monday
const FRIDAY = '2026-11-20';
const SATURDAY = '2026-11-21';
const MONDAY = '2026-11-23';

const CONTEXT: RequestNotificationContext = {
  trackingCode: 'SOL-2026-00042',
  deliveryMode: 'PRESENCIAL',
  requester: {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@ejemplo.com',
  },
  materials: [{ catalogCode: 'AHB-001', title: 'Actas del concejo de 1890' }],
  references: [],
};

const STAFF = {
  id: 'staff-1',
  firstName: 'Ana',
  middleName: null,
  lastName: 'Gómez',
  secondLastName: null,
};

/**
 * HU-23 from the API to the email: every status change queues its email in
 * the outbox and the job sends it to the requester. The request repository
 * is a fake that keeps the status and, like the Prisma one in its
 * transaction, queues the email in the in-memory outbox.
 */
describe('Status change emails (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let status: RequestStatus;
  let deliveryMode: DeliveryMode;
  let context: RequestNotificationContext;
  let appointmentDate: Date;
  const queuedDrafts: NotificationDraft[] = [];
  const outbox = new InMemoryNotificationQueue();
  const mailSender = new FakeMailSender();
  const jwt = new JwtService();
  const token = jwt.sign(
    { sub: 'staff-1', role: 'PERSONAL' },
    { secret: ACCESS_SECRET, expiresIn: 900 },
  );

  const saveChange = (
    change: StatusChange,
    email: NotificationDraft | null,
  ): SavedStatusChange => {
    status = change.newStatus;
    if (email) {
      queuedDrafts.push(email);
      outbox.enqueue(context.trackingCode, email, change.changedAt);
    }
    return {
      previousStatus: change.previousStatus,
      newStatus: change.newStatus,
      changedAt: change.changedAt,
      comment: change.comment,
      changedBy: STAFF,
    };
  };

  const repository = {
    findById: jest.fn(() =>
      Promise.resolve(new Request({ id: REQUEST_ID, status, deliveryMode })),
    ),
    findNotificationContext: jest.fn(() => Promise.resolve(context)),
    findAppointmentById: jest.fn(() =>
      Promise.resolve({
        id: APPOINTMENT_ID,
        date: appointmentDate,
        status: 'PROGRAMADA' as const,
        materialIds: [],
        request: new Request({ id: REQUEST_ID, status, deliveryMode }),
      }),
    ),
    saveStatusChange: jest.fn(
      (change: StatusChange, email: NotificationDraft | null) =>
        Promise.resolve(saveChange(change, email)),
    ),
    saveAppointment: jest.fn(
      (change: StatusChange, date: Date, email: NotificationDraft | null) => {
        appointmentDate = date;
        return Promise.resolve({
          id: APPOINTMENT_ID,
          date,
          status: 'PROGRAMADA',
          requester: { ...STAFF, id: 'requester-1' },
          materials: [],
          statusChange: saveChange(change, email),
        });
      },
    ),
    rescheduleAppointment: jest.fn(
      (
        id: string,
        change: StatusChange,
        date: Date,
        email: NotificationDraft | null,
      ) => {
        appointmentDate = date;
        return Promise.resolve({
          id,
          date,
          status: 'PROGRAMADA',
          requester: { ...STAFF, id: 'requester-1' },
          materials: [],
          statusChange: saveChange(change, email),
        });
      },
    ),
    cancelAppointment: jest.fn(
      (id: string, change: StatusChange, email: NotificationDraft | null) =>
        Promise.resolve({
          id,
          date: appointmentDate,
          status: 'CANCELADA',
          statusChange: saveChange(change, email),
        }),
    ),
    findSchedulingConflicts: jest.fn().mockResolvedValue({
      materials: [],
      bookedMaterials: [],
    }),
    countActiveAppointmentsOnDate: jest.fn().mockResolvedValue(0),
    countActiveAppointmentsByDateRange: jest.fn().mockResolvedValue([]),
    countAppointmentLoans: jest
      .fn()
      .mockResolvedValue({ totalLoans: 0, openLoans: 0 }),
    countScheduledAppointmentLoansByRequest: jest
      .fn()
      .mockResolvedValue({ totalLoans: 0, openLoans: 0 }),
  };

  const changeStatus = (body: object) =>
    request(server)
      .patch(STATUS_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const runJob = () => app.get(SendPendingNotificationsJob).run();

  beforeAll(async () => {
    process.env.JWT_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // One fake answers both the entity repository and the query service
      .overrideProvider(REQUEST_REPOSITORY)
      .useValue(repository)
      .overrideProvider(REQUEST_QUERY_SERVICE)
      .useValue(repository)
      .overrideProvider(ROOM_CAPACITY_REPOSITORY)
      .useValue({
        getConfig: jest.fn().mockResolvedValue({
          dailyCapacity: 15,
          isDefault: true,
          updatedAt: null,
          updatedBy: null,
        }),
        saveDailyCapacity: jest.fn(),
      })
      .overrideProvider(NOTIFICATION_QUEUE)
      .useValue(outbox)
      .overrideProvider(MAIL_SENDER)
      .useValue(mailSender)
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(new InMemoryRefreshTokenRepository())
      // HTTP fakes still need an active account for the global session check (HU-33).
      .overrideProvider(USER_REPOSITORY)
      .useValue({
        findById: (id: string) => Promise.resolve({ id, active: true }),
      })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    status = 'RECIBIDA';
    deliveryMode = 'PRESENCIAL';
    context = { ...CONTEXT };
    appointmentDate = new Date(`${FRIDAY}T00:00:00.000Z`);
    queuedDrafts.length = 0;
    outbox.rows.length = 0;
    mailSender.sent.length = 0;
    mailSender.failing = false;
  });

  it('emails the requester once on every status change, using its own template, subject and body', async () => {
    const steps: {
      template: NotificationTemplate;
      subject: string;
      statusLabel: string;
      bodySnippet: string;
      run: () => Promise<unknown>;
    }[] = [
      {
        template: 'SOLICITUD_EN_BUSQUEDA',
        subject: 'Estamos buscando el material de su solicitud SOL-2026-00042',
        statusLabel: 'En búsqueda',
        bodySnippet:
          'comenzó a buscar el material de su solicitud SOL-2026-00042',
        run: () => changeStatus({ status: 'EN_BUSQUEDA' }).expect(200),
      },
      {
        template: 'SOLICITUD_DISPONIBLE',
        subject: 'El material de su solicitud SOL-2026-00042 está disponible',
        statusLabel: 'Disponible',
        bodySnippet:
          'agendará una cita para que pueda revisarlo en la sala de consulta',
        run: () => changeStatus({ status: 'DISPONIBLE' }).expect(200),
      },
      {
        template: 'SOLICITUD_AGENDADA',
        subject: 'Cita agendada para su solicitud SOL-2026-00042',
        statusLabel: 'Agendada',
        bodySnippet:
          'agendó una cita para que consulte el material de su solicitud SOL-2026-00042',
        run: () =>
          request(server)
            .post(APPOINTMENTS_PATH)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: FRIDAY })
            .expect(201),
      },
      {
        template: 'SOLICITUD_ATENDIDA',
        subject: 'Su solicitud SOL-2026-00042 fue atendida',
        statusLabel: 'Atendida',
        bodySnippet: 'realizó la consulta de su material en la sala del CLENA',
        run: () => changeStatus({ status: 'ATENDIDA' }).expect(200),
      },
      {
        template: 'SOLICITUD_CERRADA',
        subject: 'Su solicitud SOL-2026-00042 fue cerrada',
        statusLabel: 'Cerrada',
        bodySnippet: 'se ha cerrado y el trámite concluyó',
        run: () => changeStatus({ status: 'CERRADA' }).expect(200),
      },
    ];

    for (const step of steps) {
      await step.run();
      await runJob();

      const lastDraft = queuedDrafts[queuedDrafts.length - 1];
      const last = mailSender.sent[mailSender.sent.length - 1];
      expect(lastDraft.template).toBe(step.template);
      expect(last.to).toBe('juan@ejemplo.com');
      expect(last.subject).toBe(step.subject);
      expect(last.text).toContain(`Estado actual: ${step.statusLabel}`);
      expect(last.text).toContain(step.bodySnippet);
      expect(last.text).toContain('AHB-001 · Actas del concejo de 1890');
      expect(last.html).toContain(step.bodySnippet);
    }

    // One email per change, all sent
    expect(mailSender.sent).toHaveLength(steps.length);
    expect(outbox.rows.every((row) => row.deliveryStatus === 'ENVIADA')).toBe(
      true,
    );
  });

  it('includes the day and the service hours of the appointment', async () => {
    status = 'DISPONIBLE';

    await request(server)
      .post(APPOINTMENTS_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: FRIDAY })
      .expect(201);
    await runJob();

    expect(queuedDrafts[0].template).toBe('SOLICITUD_AGENDADA');
    expect(mailSender.sent[0].text).toContain(
      'Fecha de la cita: viernes, 20 de noviembre de 2026',
    );
    expect(mailSender.sent[0].text).toContain(
      'Horario de atención: de 8:00 a 17:00',
    );
  });

  it('includes the reason of a rejection without duplicating it as a staff comment', async () => {
    await changeStatus({
      status: 'RECHAZADA',
      comment: 'El material está restringido por la familia donante',
    }).expect(200);
    await runJob();

    expect(mailSender.sent).toHaveLength(1);
    expect(queuedDrafts[0].template).toBe('SOLICITUD_RECHAZADA');
    expect(mailSender.sent[0].subject).toBe(
      'No fue posible atender su solicitud SOL-2026-00042',
    );
    expect(mailSender.sent[0].text).toContain(
      'Motivo del rechazo: El material está restringido por la familia donante',
    );
    expect(mailSender.sent[0].text).not.toContain('Observaciones del personal');
  });

  it('adapts the DISPONIBLE email copy to DIGITAL vs PRESENCIAL delivery mode', async () => {
    deliveryMode = 'DIGITAL';
    context = { ...CONTEXT, deliveryMode: 'DIGITAL' };
    status = 'EN_BUSQUEDA';

    await changeStatus({ status: 'DISPONIBLE' }).expect(200);
    await runJob();

    expect(queuedDrafts[0].template).toBe('SOLICITUD_DISPONIBLE');
    expect(mailSender.sent[0].text).toContain(
      'Modo de entrega: Copia digital por correo',
    );
    expect(mailSender.sent[0].text).toContain(
      'le enviará la copia por correo electrónico',
    );
    expect(mailSender.sent[0].text).not.toContain('sala de consulta');

    deliveryMode = 'PRESENCIAL';
    context = { ...CONTEXT, deliveryMode: 'PRESENCIAL' };
    status = 'EN_BUSQUEDA';

    await changeStatus({ status: 'DISPONIBLE' }).expect(200);
    await runJob();

    expect(queuedDrafts[1].template).toBe('SOLICITUD_DISPONIBLE');
    expect(mailSender.sent[1].text).toContain(
      'Modo de entrega: Consulta presencial en sala',
    );
    expect(mailSender.sent[1].text).toContain(
      'agendará una cita para que pueda revisarlo en la sala de consulta',
    );
  });

  it('includes staff comments escaped in HTML and omits the section without comment', async () => {
    await changeStatus({
      status: 'EN_BUSQUEDA',
      comment: 'Revisar caja <3> & "anexos"',
    }).expect(200);
    await runJob();

    expect(mailSender.sent[0].text).toContain(
      'Observaciones del personal:\nRevisar caja <3> & "anexos"',
    );
    expect(mailSender.sent[0].html).toContain('Observaciones del personal:');
    expect(mailSender.sent[0].html).toContain(
      'Revisar caja &lt;3&gt; &amp; &quot;anexos&quot;',
    );
    expect(mailSender.sent[0].html).not.toContain('<3>');

    await changeStatus({ status: 'DISPONIBLE' }).expect(200);
    await runJob();

    expect(mailSender.sent[1].text).not.toContain('Observaciones del personal');
    expect(mailSender.sent[1].html).not.toContain('Observaciones del personal');
  });

  it('emails CITA_REPROGRAMADA with previous and new dates, with and without comment', async () => {
    status = 'AGENDADA';

    await request(server)
      .patch(RESCHEDULE_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: SATURDAY })
      .expect(200);
    await runJob();

    expect(queuedDrafts[0].template).toBe('CITA_REPROGRAMADA');
    expect(mailSender.sent[0].subject).toBe(
      'Su cita de la solicitud SOL-2026-00042 fue reprogramada',
    );
    expect(mailSender.sent[0].text).toContain(
      'Fecha anterior: viernes, 20 de noviembre de 2026',
    );
    expect(mailSender.sent[0].text).toContain(
      'Nueva fecha de la cita: sábado, 21 de noviembre de 2026',
    );
    expect(mailSender.sent[0].text).toContain(
      'Horario de atención: de 9:00 a 13:00',
    );
    expect(mailSender.sent[0].text).not.toContain('Observaciones del personal');

    await request(server)
      .patch(RESCHEDULE_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: MONDAY, comment: 'Cambio solicitado por el usuario' })
      .expect(200);
    await runJob();

    expect(queuedDrafts[1].template).toBe('CITA_REPROGRAMADA');
    expect(mailSender.sent[1].text).toContain(
      'Fecha anterior: sábado, 21 de noviembre de 2026',
    );
    expect(mailSender.sent[1].text).toContain(
      'Nueva fecha de la cita: lunes, 23 de noviembre de 2026',
    );
    expect(mailSender.sent[1].text).toContain(
      'Horario de atención: de 8:00 a 17:00',
    );
    expect(mailSender.sent[1].text).toContain(
      'Observaciones del personal:\nCambio solicitado por el usuario',
    );
    expect(mailSender.sent[1].html).toContain(
      'Cambio solicitado por el usuario',
    );
  });

  it('emails CITA_CANCELADA with the cancelled date, with and without comment', async () => {
    status = 'AGENDADA';

    await request(server)
      .patch(CANCEL_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    await runJob();

    expect(queuedDrafts[0].template).toBe('CITA_CANCELADA');
    expect(mailSender.sent[0].subject).toBe(
      'La cita de su solicitud SOL-2026-00042 fue cancelada',
    );
    expect(mailSender.sent[0].text).toContain('Estado actual: Disponible');
    expect(mailSender.sent[0].text).toContain(
      'Fecha de la cita cancelada: viernes, 20 de noviembre de 2026',
    );
    expect(mailSender.sent[0].text).not.toContain('Observaciones del personal');

    status = 'AGENDADA';
    await request(server)
      .patch(CANCEL_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Sala cerrada por mantenimiento' })
      .expect(200);
    await runJob();

    expect(queuedDrafts[1].template).toBe('CITA_CANCELADA');
    expect(mailSender.sent[1].text).toContain(
      'Fecha de la cita cancelada: viernes, 20 de noviembre de 2026',
    );
    expect(mailSender.sent[1].text).toContain(
      'Observaciones del personal:\nSala cerrada por mantenimiento',
    );
    expect(mailSender.sent[1].html).toContain('Sala cerrada por mantenimiento');
  });

  it('lists pending written references when the request has no catalog materials', async () => {
    context = {
      ...CONTEXT,
      materials: [],
      references: ['Escritura 57 de 1940, Notaría Primera'],
    };

    await changeStatus({ status: 'EN_BUSQUEDA' }).expect(200);
    await runJob();

    expect(mailSender.sent[0].text).toContain(
      'Material solicitado:\n- Escritura 57 de 1940, Notaría Primera',
    );
    expect(mailSender.sent[0].html).toContain(
      '<li>Escritura 57 de 1940, Notaría Primera</li>',
    );
  });

  it('sends nothing when the change is refused', async () => {
    await changeStatus({ status: 'RECHAZADA' }).expect(400);
    await changeStatus({ status: 'CERRADA' }).expect(409);
    await runJob();

    expect(outbox.rows).toHaveLength(0);
    expect(mailSender.sent).toHaveLength(0);
  });

  describe('when the mail server fails', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('keeps the status change, logs the failure and sends the email later', async () => {
      mailSender.failing = true;

      // The change is answered and saved as always
      const response = await changeStatus({ status: 'EN_BUSQUEDA' }).expect(
        200,
      );
      expect(response.body).toMatchObject({ status: 'EN_BUSQUEDA' });
      expect(status).toBe('EN_BUSQUEDA');

      await runJob();

      // Nothing was sent, and the failure is in the log
      expect(mailSender.sent).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /Could not send the email .* of request SOL-2026-00042 \(attempt 1 of 5\)/,
        ),
      );
      expect(outbox.rows[0]).toMatchObject({
        deliveryStatus: 'PENDIENTE',
        attempts: 1,
        lastError: 'No se pudo enviar el correo. Revisa la configuración SMTP',
      });

      // The server is back: the next attempt, a minute later, sends it
      mailSender.failing = false;
      await app
        .get(SendPendingNotificationsUseCase)
        .execute({ now: new Date(Date.now() + 61_000) });

      expect(mailSender.sent).toHaveLength(1);
      expect(mailSender.sent[0].subject).toBe(
        'Estamos buscando el material de su solicitud SOL-2026-00042',
      );
      expect(outbox.rows[0].deliveryStatus).toBe('ENVIADA');
      // The request kept its new status the whole time
      expect(status).toBe('EN_BUSQUEDA');
    });
  });
});
