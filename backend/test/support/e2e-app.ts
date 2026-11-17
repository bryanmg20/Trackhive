import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { MAIL_SENDER } from '../../src/notifications/application/tokens';
import { SEND_PENDING_NOTIFICATIONS_JOB } from '../../src/notifications/infrastructure/jobs/send-pending-notifications.job';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  addBusinessDays,
  todayInBogota,
} from '../../src/requests/domain/value-objects/desired-date';
import type { UserRole } from '../../src/users/domain/enums/user-role';
import { FakeMailSender } from '../fakes/fake-mail-sender';

/**
 * The whole API against the isolated PostgreSQL of the e2e tests (HU-41).
 * Only what leaves the system is replaced: the mail server (FakeMailSender,
 * D-21). Repositories, query services, the tracking code sequence and the
 * migrations are the real ones.
 */
export interface E2eApp {
  app: INestApplication;
  server: Server;
  prisma: PrismaService;
  mail: FakeMailSender;
}

export const API = '/api/v1';
export const PASSWORD = 'secreto123';

export async function createE2eApp(): Promise<E2eApp> {
  process.env.JWT_SECRET ??= 'e2e-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret';

  const mail = new FakeMailSender();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_SENDER)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  // Every e2e file shares the database: the job of one file must not send
  // the emails queued by another, so the outbox is only checked in the rows
  const scheduler = app.get(SchedulerRegistry);
  if (scheduler.getIntervals().includes(SEND_PENDING_NOTIFICATIONS_JOB)) {
    scheduler.deleteInterval(SEND_PENDING_NOTIFICATIONS_JOB);
  }

  return {
    app,
    server: app.getHttpServer() as Server,
    prisma: app.get(PrismaService),
    mail,
  };
}

/** A unique email, so the e2e files never collide in the shared database. */
export const uniqueEmail = (prefix: string): string =>
  `${prefix}-${randomUUID().slice(0, 8)}@trackhive.test`;

/** The body of a public registration with its characterization (HU-01). */
export const registrationBody = (email: string) => ({
  firstName: 'Ana',
  middleName: 'María',
  lastName: 'Pérez',
  secondLastName: 'Gómez',
  email,
  password: PASSWORD,
  acceptedPrivacy: true,
  privacyPolicyVersion: '1.1',
  municipality: 'Barranquilla',
  ageRange: '18-28',
});

export interface Session {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export async function login(
  server: Server,
  email: string,
  password = PASSWORD,
): Promise<Omit<Session, 'userId' | 'email'>> {
  const response = await request(server)
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);
  return response.body as { accessToken: string; refreshToken: string };
}

/** Registers a public account through the API and signs in with it. */
export async function signUpPublicUser(
  server: Server,
  prefix = 'publico',
): Promise<Session> {
  const email = uniqueEmail(prefix);
  const response = await request(server)
    .post(`${API}/users`)
    .send(registrationBody(email))
    .expect(201);
  const { id } = response.body as { id: string };
  return { userId: id, email, ...(await login(server, email)) };
}

/**
 * Staff accounts have no public sign-up: they are inserted like the seed
 * does, with an argon2 hash, and then sign in through the API.
 */
export async function signInStaffUser(
  { server, prisma }: E2eApp,
  role: Extract<UserRole, 'PERSONAL' | 'ADMIN'> = 'PERSONAL',
): Promise<Session> {
  const id = randomUUID();
  const email = uniqueEmail(role.toLowerCase());
  await prisma.userModel.create({
    data: {
      id,
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      email,
      passwordHash: await argon2.hash(PASSWORD),
      role,
    },
  });
  return { userId: id, email, ...(await login(server, email)) };
}

/** A material of the archive. Each one has its own catalog code and agenda. */
export async function createMaterial(
  prisma: PrismaService,
  title = 'Actas del Concejo de 1890',
): Promise<{ id: string; catalogCode: string; title: string }> {
  const id = randomUUID();
  const catalogCode = `E2E-${id.slice(0, 8).toUpperCase()}`;
  await prisma.materialModel.create({
    data: {
      id,
      catalogCode,
      title,
      materialType: 'DOCUMENTO',
      collection: 'Fondo del Concejo',
      depot: 'D1',
      shelf: 'E3',
      box: 'C12',
      status: 'DISPONIBLE',
    },
  });
  return { id, catalogCode, title };
}

/** The first desired date the rules accept: 10 business days from today. */
export const validDesiredDate = (): string =>
  addBusinessDays(todayInBogota(), 10).toISOString().slice(0, 10);

/**
 * A future day on which the CLENA attends (Monday to Saturday), as
 * YYYY-MM-DD. `skip` gives the next ones, for a second appointment.
 */
export function serviceDay(skip = 0): string {
  const day = addBusinessDays(todayInBogota(), 5 + skip);
  return day.toISOString().slice(0, 10);
}

/** The next Sunday from today, as YYYY-MM-DD. */
export function nextSunday(): string {
  const day = todayInBogota();
  day.setUTCDate(day.getUTCDate() + ((7 - day.getUTCDay()) % 7 || 7));
  return day.toISOString().slice(0, 10);
}

export const bearer = (session: Session): string =>
  `Bearer ${session.accessToken}`;

/** Files a request of the public user in the token (HU-09). */
export async function submitRequest(
  server: Server,
  requester: Session,
  materialIds: string[],
  deliveryMode: 'PRESENCIAL' | 'DIGITAL' = 'PRESENCIAL',
  desiredDate: string = validDesiredDate(),
): Promise<{ id: string; trackingCode: string; status: string }> {
  const response = await request(server)
    .post(`${API}/requests`)
    .set('Authorization', bearer(requester))
    .send({
      materialIds,
      reason: 'Consulta para un trabajo de investigación',
      desiredDate,
      deliveryMode,
    })
    .expect(201);
  return response.body as { id: string; trackingCode: string; status: string };
}

/** Changes the status of a request as staff (HU-15). */
export const changeStatus = (
  server: Server,
  staff: Session,
  requestId: string,
  body: { status: string; comment?: string },
) =>
  request(server)
    .patch(`${API}/requests/${requestId}/status`)
    .set('Authorization', bearer(staff))
    .send(body);
