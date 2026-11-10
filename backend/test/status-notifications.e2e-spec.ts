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
  NOTIFICATION_REPOSITORY,
} from '../src/notifications/application/tokens';
import { SendPendingNotificationsUseCase } from '../src/notifications/application/use-cases/send-pending-notifications.use-case';
import type { NotificationDraft } from '../src/notifications/domain/notification-draft';
import { SendPendingNotificationsJob } from '../src/notifications/infrastructure/jobs/send-pending-notifications.job';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  RequestNotificationContext,
  SavedStatusChange,
} from '../src/requests/application/ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../src/requests/application/tokens';
import { Request } from '../src/requests/domain/entities/request.entity';
import type { RequestStatus } from '../src/requests/domain/request-status';
import type { StatusChange } from '../src/requests/domain/status-change';
import { FakeMailSender } from './fakes/fake-mail-sender';
import { InMemoryNotificationRepository } from './fakes/in-memory-notification.repository';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const REQUEST_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';
const STATUS_PATH = `/api/v1/requests/${REQUEST_ID}/status`;
const APPOINTMENTS_PATH = `/api/v1/requests/${REQUEST_ID}/appointments`;
// 2026-11-20 is a Friday
const FRIDAY = '2026-11-20';

const CONTEXT: RequestNotificationContext = {
  trackingCode: 'SOL-2026-00042',
  requester: {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@ejemplo.com',
  },
  materials: [{ catalogCode: 'AHB-001', title: 'Actas del concejo de 1890' }],
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
  const outbox = new InMemoryNotificationRepository();
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
      outbox.enqueue(CONTEXT.trackingCode, email, change.changedAt);
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
    findEntityById: jest.fn(() =>
      Promise.resolve(
        new Request({ id: REQUEST_ID, status, deliveryMode: 'PRESENCIAL' }),
      ),
    ),
    // HU-20: every material is free on the day of the appointment
    findMaterialAvailability: jest.fn(() => Promise.resolve([])),
    findNotificationContext: jest.fn(() => Promise.resolve(CONTEXT)),
    saveStatusChange: jest.fn(
      (change: StatusChange, email: NotificationDraft | null) =>
        Promise.resolve(saveChange(change, email)),
    ),
    saveAppointment: jest.fn(
      (change: StatusChange, date: Date, email: NotificationDraft | null) =>
        Promise.resolve({
          id: 'appointment-1',
          date,
          status: 'PROGRAMADA',
          requester: { ...STAFF, id: 'requester-1' },
          materials: [],
          statusChange: saveChange(change, email),
        }),
    ),
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
      .overrideProvider(REQUEST_REPOSITORY)
      .useValue(repository)
      .overrideProvider(NOTIFICATION_REPOSITORY)
      .useValue(outbox)
      .overrideProvider(MAIL_SENDER)
      .useValue(mailSender)
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(new InMemoryRefreshTokenRepository())
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
    outbox.rows.length = 0;
    mailSender.sent.length = 0;
    mailSender.failing = false;
  });

  it('emails the requester once on every status change, with the new status and the material', async () => {
    const steps: [string, () => Promise<unknown>][] = [
      ['En búsqueda', () => changeStatus({ status: 'EN_BUSQUEDA' })],
      ['Disponible', () => changeStatus({ status: 'DISPONIBLE' })],
      [
        'Agendada',
        () =>
          request(server)
            .post(APPOINTMENTS_PATH)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: FRIDAY })
            .expect(201),
      ],
      ['Atendida', () => changeStatus({ status: 'ATENDIDA' })],
      ['Cerrada', () => changeStatus({ status: 'CERRADA' })],
    ];

    for (const [label, step] of steps) {
      await step();
      await runJob();

      const last = mailSender.sent[mailSender.sent.length - 1];
      expect(last.to).toBe('juan@ejemplo.com');
      expect(last.subject).toBe(
        `Su solicitud SOL-2026-00042 pasó a «${label}»`,
      );
      expect(last.text).toContain(`Nuevo estado: ${label}`);
      expect(last.text).toContain('AHB-001 · Actas del concejo de 1890');
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

    expect(mailSender.sent[0].text).toContain(
      'Fecha de la cita: viernes, 20 de noviembre de 2026',
    );
    expect(mailSender.sent[0].text).toContain(
      'Horario de atención: de 8:00 a 17:00',
    );
  });

  it('includes the reason of a rejection', async () => {
    await changeStatus({
      status: 'RECHAZADA',
      comment: 'El material está restringido por la familia donante',
    }).expect(200);
    await runJob();

    expect(mailSender.sent).toHaveLength(1);
    expect(mailSender.sent[0].text).toContain(
      'Motivo del rechazo: El material está restringido por la familia donante',
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
        .execute(new Date(Date.now() + 61_000));

      expect(mailSender.sent).toHaveLength(1);
      expect(mailSender.sent[0].subject).toBe(
        'Su solicitud SOL-2026-00042 pasó a «En búsqueda»',
      );
      expect(outbox.rows[0].deliveryStatus).toBe('ENVIADA');
      // The request kept its new status the whole time
      expect(status).toBe('EN_BUSQUEDA');
    });
  });
});
