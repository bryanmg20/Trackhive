import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  SavedAppointment,
  SavedStatusChange,
} from '../src/requests/application/ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../src/requests/application/tokens';
import {
  addBusinessDays,
  todayInBogota,
} from '../src/requests/domain/desired-date';
import { Request } from '../src/requests/domain/entities/request.entity';
import { RequestStatusConflictError } from '../src/requests/domain/errors/request-status-conflict.error';
import type { StatusChange } from '../src/requests/domain/status-change';
import type { UserRole } from '../src/users/domain/user-role';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const REQUESTS_PATH = '/api/v1/requests';
const MINE_PATH = '/api/v1/requests/mine';
const ON_BEHALF_PATH = '/api/v1/requests/on-behalf';
const REQUESTERS_PATH = '/api/v1/requesters/by-email';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

describe('Request registration (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const jwt = new JwtService();
  const repository = {
    create: jest.fn().mockResolvedValue({
      id: 'request-1',
      trackingCode: 'SOL-2026-00001',
      status: 'RECIBIDA',
    }),
    createOnBehalf: jest.fn().mockResolvedValue({
      id: 'request-2',
      trackingCode: 'SOL-2026-00002',
      status: 'RECIBIDA',
    }),
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: jest.fn(),
    listByRequesterUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findEntityById: jest.fn(),
    saveStatusChange: jest.fn(),
    saveAppointment: jest.fn(),
    findRequesterByEmail: jest.fn().mockResolvedValue({
      requesterId: 'requester-1',
      userId: null,
      firstName: 'Visitante',
      middleName: null,
      lastName: 'Prueba',
      secondLastName: null,
      email: 'visitante@ejemplo.com',
      phone: '3001234567',
      requesterType: 'CIUDADANO',
      institution: null,
      documentType: 'CC',
      documentNumber: '123456789',
      foundIn: 'REQUESTER',
    }),
  };

  const accessToken = (role: UserRole, sub = 'user-1') =>
    jwt.sign({ sub, role }, { secret: ACCESS_SECRET, expiresIn: 900 });

  const validBody = () => ({
    materialIds: ['c3f6c8f0-1c2b-4e3d-8f4a-123456789abc'],
    reason: 'Consulta para un trabajo de investigación',
    desiredDate: addBusinessDays(todayInBogota(), 10)
      .toISOString()
      .slice(0, 10),
    deliveryMode: 'PRESENCIAL',
  });

  const onBehalfBody = () => ({
    ...validBody(),
    requester: {
      email: 'visitante@ejemplo.com',
      firstName: 'Visitante',
      lastName: 'Prueba',
      phone: '3001234567',
      requesterType: 'CIUDADANO',
      documentType: 'CC',
      documentNumber: '123456789',
    },
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REQUEST_REPOSITORY)
      .useValue(repository)
      // The startup purge of expired tokens (HU-3.1) needs a repository
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('public self-registration', () => {
    it('creates a request with 201, status RECIBIDA and a tracking code', async () => {
      const response = await request(server)
        .post(REQUESTS_PATH)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .send(validBody())
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'request-1',
        trackingCode: 'SOL-2026-00001',
        status: 'RECIBIDA',
      });
    });

    it.each(['PERSONAL', 'ADMIN'] as UserRole[])(
      'rejects a %s user with 403',
      async (role) => {
        const response = await request(server)
          .post(REQUESTS_PATH)
          .set('Authorization', `Bearer ${accessToken(role)}`)
          .send(validBody())
          .expect(403);

        expect(response.body as ErrorBody).toMatchObject({
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      },
    );

    it('rejects an invalid desired date with 400 and INVALID_DESIRED_DATE', async () => {
      const response = await request(server)
        .post(REQUESTS_PATH)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .send({ ...validBody(), desiredDate: '2020-01-01' })
        .expect(400);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 400,
        code: 'INVALID_DESIRED_DATE',
      });
    });
  });

  describe('staff registration on behalf of a visitor', () => {
    it.each(['PERSONAL', 'ADMIN'] as UserRole[])(
      'lets %s register a valid request with 201',
      async (role) => {
        const response = await request(server)
          .post(ON_BEHALF_PATH)
          .set('Authorization', `Bearer ${accessToken(role)}`)
          .send(onBehalfBody())
          .expect(201);

        expect(response.body).toMatchObject({
          id: 'request-2',
          trackingCode: 'SOL-2026-00002',
          status: 'RECIBIDA',
        });
        expect(repository.createOnBehalf).toHaveBeenCalledWith(
          expect.objectContaining({
            createdById: 'user-1',
            requester: expect.objectContaining({
              email: 'visitante@ejemplo.com',
            }) as unknown,
          }),
        );
      },
    );

    it('rejects a public user with 403', async () => {
      const response = await request(server)
        .post(ON_BEHALF_PATH)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .send(onBehalfBody())
        .expect(403);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('rejects an invalid desired date with 400 and INVALID_DESIRED_DATE', async () => {
      const response = await request(server)
        .post(ON_BEHALF_PATH)
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ ...onBehalfBody(), desiredDate: '2020-01-01' })
        .expect(400);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 400,
        code: 'INVALID_DESIRED_DATE',
      });
    });

    it('rejects a request without the requester email with 400', async () => {
      const body = onBehalfBody();
      delete (body.requester as { email?: string }).email;

      const response = await request(server)
        .post(ON_BEHALF_PATH)
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send(body)
        .expect(400);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('requester lookup', () => {
    it('returns the requester data for a staff user', async () => {
      const response = await request(server)
        .get(`${REQUESTERS_PATH}?email=visitante@ejemplo.com`)
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .expect(200);

      expect(response.body).toMatchObject({
        requesterId: 'requester-1',
        email: 'visitante@ejemplo.com',
        firstName: 'Visitante',
        lastName: 'Prueba',
        foundIn: 'REQUESTER',
      });
      expect(repository.findRequesterByEmail).toHaveBeenCalledWith(
        'visitante@ejemplo.com',
      );
    });

    it('rejects a public user with 403', async () => {
      const response = await request(server)
        .get(`${REQUESTERS_PATH}?email=visitante@ejemplo.com`)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .expect(403);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('returns 404 when the email is unknown', async () => {
      repository.findRequesterByEmail.mockResolvedValueOnce(null);

      const response = await request(server)
        .get(`${REQUESTERS_PATH}?email=desconocido@ejemplo.com`)
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .expect(404);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 404,
        code: 'REQUESTER_NOT_FOUND',
      });
    });
  });

  describe('GET /requests (list, HU-12)', () => {
    beforeEach(() => {
      repository.list.mockClear();
    });

    it('rejects a request without an access token with 401', async () => {
      await request(server).get(REQUESTS_PATH).expect(401);
    });

    it('rejects a PUBLICO user with 403 and does not query', async () => {
      await request(server)
        .get(REQUESTS_PATH)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .expect(403);
      expect(repository.list).not.toHaveBeenCalled();
    });

    it.each<UserRole>(['PERSONAL', 'ADMIN'])(
      'lets %s list with the default order and page',
      async (role) => {
        await request(server)
          .get(REQUESTS_PATH)
          .set('Authorization', `Bearer ${accessToken(role)}`)
          .expect(200, { items: [], page: 1, limit: 20, total: 0 });

        expect(repository.list).toHaveBeenCalledWith(
          expect.objectContaining({
            sort: 'registeredAt',
            order: 'desc',
            page: 1,
            limit: 20,
          }),
        );
      },
    );

    it('passes the filters and the order to the repository', async () => {
      await request(server)
        .get(REQUESTS_PATH)
        .query({
          status: 'AGENDADA',
          desiredFrom: '2026-12-01',
          desiredTo: '2026-12-31',
          requester: 'juan',
          material: 'cabildo',
          sort: 'desiredDate',
          order: 'asc',
          page: 2,
          limit: 5,
        })
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .expect(200);

      expect(repository.list).toHaveBeenCalledWith({
        status: 'AGENDADA',
        desiredFrom: '2026-12-01',
        desiredTo: '2026-12-31',
        requester: 'juan',
        material: 'cabildo',
        sort: 'desiredDate',
        order: 'asc',
        page: 2,
        limit: 5,
      });
    });

    it.each([
      { status: 'ROTA' },
      { desiredFrom: '2026-13-45' },
      { sort: 'status' },
      { limit: 1000 },
      { unknown: 'x' },
    ])('rejects invalid parameters %j with 400', async (query) => {
      await request(server)
        .get(REQUESTS_PATH)
        .query(query)
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .expect(400);
      expect(repository.list).not.toHaveBeenCalled();
    });
  });

  describe('GET /requests/:id (detail, HU-13)', () => {
    const REQUEST_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';
    const detailPath = (id: string) => `${REQUESTS_PATH}/${id}`;
    const detail = {
      id: REQUEST_ID,
      trackingCode: 'SOL-2026-00001',
      status: 'RECIBIDA',
      deliveryMode: 'PRESENCIAL',
      originChannel: 'WEB',
      reason: 'Investigación',
      requirementDescription: 'Actas',
      desiredDate: new Date('2026-12-01T00:00:00.000Z'),
      committedDate: null,
      registeredAt: new Date('2026-11-10T15:00:00.000Z'),
      rejectionReason: null,
      requester: {
        firstName: 'Juan',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: null,
        email: 'juan@mail.com',
        phone: null,
        requesterType: 'INVESTIGADOR',
        institution: null,
        documentType: null,
        documentNumber: null,
      },
      materials: [],
    };

    beforeEach(() => {
      repository.findById.mockReset();
      repository.findById.mockResolvedValue(detail);
    });

    it('rejects a request without an access token with 401', async () => {
      await request(server).get(detailPath(REQUEST_ID)).expect(401);
    });

    it('rejects a PUBLICO user with 403 and does not query', async () => {
      await request(server)
        .get(detailPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .expect(403);
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it.each<UserRole>(['PERSONAL', 'ADMIN'])(
      'lets %s see the detail of a request',
      async (role) => {
        const response = await request(server)
          .get(detailPath(REQUEST_ID))
          .set('Authorization', `Bearer ${accessToken(role)}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: REQUEST_ID,
          trackingCode: 'SOL-2026-00001',
          status: 'RECIBIDA',
          desiredDate: '2026-12-01',
          requester: { name: 'Juan Pérez', email: 'juan@mail.com' },
        });
      },
    );

    it('rejects an id that is not a UUID with 400', async () => {
      await request(server)
        .get(detailPath('no-es-uuid'))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .expect(400);
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('answers 404 when the request does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const response = await request(server)
        .get(detailPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .expect(404);

      expect((response.body as ErrorBody).code).toBe('REQUEST_NOT_FOUND');
    });

    it('includes the valid next statuses for the change status action (HU-15)', async () => {
      const response = await request(server)
        .get(detailPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .expect(200);

      expect(
        (response.body as { allowedTransitions: string[] }).allowedTransitions,
      ).toEqual(['EN_BUSQUEDA', 'RECHAZADA']);
    });
  });

  describe('PATCH /requests/:id/status (change status, HU-15)', () => {
    const REQUEST_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';
    const statusPath = (id: string) => `${REQUESTS_PATH}/${id}/status`;

    interface ChangeStatusBody {
      id: string;
      status: string;
      allowedTransitions: string[];
      statusChange: {
        previousStatus: string;
        newStatus: string;
        changedAt: string;
        changedBy: { id: string; name: string };
        comment: string | null;
      };
    }

    const entity = (status: Request['status']) =>
      new Request({ id: REQUEST_ID, status, deliveryMode: 'PRESENCIAL' });

    beforeEach(() => {
      repository.findEntityById.mockReset();
      repository.findEntityById.mockResolvedValue(entity('AGENDADA'));
      repository.saveStatusChange.mockReset();
      repository.saveStatusChange.mockImplementation(
        (change: StatusChange): Promise<SavedStatusChange> =>
          Promise.resolve({
            previousStatus: change.previousStatus,
            newStatus: change.newStatus,
            changedAt: change.changedAt,
            comment: change.comment,
            changedBy: {
              id: change.changedBy,
              firstName: 'Ana',
              middleName: null,
              lastName: 'Gómez',
              secondLastName: null,
            },
          }),
      );
    });

    const savedChange = () =>
      (repository.saveStatusChange.mock.calls[0] as [StatusChange])[0];

    it('rejects a request without an access token with 401', async () => {
      await request(server)
        .patch(statusPath(REQUEST_ID))
        .send({ status: 'ATENDIDA' })
        .expect(401);
      expect(repository.saveStatusChange).not.toHaveBeenCalled();
    });

    it('rejects a PUBLICO user with 403 and changes nothing', async () => {
      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .send({ status: 'ATENDIDA' })
        .expect(403);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
      expect(repository.findEntityById).not.toHaveBeenCalled();
      expect(repository.saveStatusChange).not.toHaveBeenCalled();
    });

    it.each<UserRole>(['PERSONAL', 'ADMIN'])(
      'lets %s change the status and saves date, time, responsible and comment',
      async (role) => {
        const before = Date.now();

        const response = await request(server)
          .patch(statusPath(REQUEST_ID))
          .set('Authorization', `Bearer ${accessToken(role, 'staff-7')}`)
          .send({ status: 'ATENDIDA', comment: '  Consultó las actas  ' })
          .expect(200);

        expect(repository.findEntityById).toHaveBeenCalledWith(REQUEST_ID);
        expect(savedChange()).toMatchObject({
          requestId: REQUEST_ID,
          previousStatus: 'AGENDADA',
          newStatus: 'ATENDIDA',
          // The responsible is the user of the token
          changedBy: 'staff-7',
          comment: 'Consultó las actas',
        });
        expect(savedChange().changedAt.getTime()).toBeGreaterThanOrEqual(
          before,
        );

        const body = response.body as ChangeStatusBody;
        expect(body).toMatchObject({
          id: REQUEST_ID,
          status: 'ATENDIDA',
          allowedTransitions: ['CERRADA'],
          statusChange: {
            previousStatus: 'AGENDADA',
            newStatus: 'ATENDIDA',
            changedBy: { id: 'staff-7', name: 'Ana Gómez' },
            comment: 'Consultó las actas',
          },
        });
        expect(new Date(body.statusChange.changedAt).getTime()).toBe(
          savedChange().changedAt.getTime(),
        );
      },
    );

    it('accepts a change without a comment', async () => {
      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ status: 'ATENDIDA' })
        .expect(200);

      expect(savedChange().comment).toBeNull();
      expect((response.body as ChangeStatusBody).statusChange.comment).toBe(
        null,
      );
    });

    it('moves a scheduled request back to DISPONIBLE when the requester did not attend', async () => {
      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ status: 'DISPONIBLE', comment: 'No asistió a la cita' })
        .expect(200);

      expect(response.body as ChangeStatusBody).toMatchObject({
        status: 'DISPONIBLE',
        allowedTransitions: ['AGENDADA', 'CERRADA'],
        statusChange: { previousStatus: 'AGENDADA', newStatus: 'DISPONIBLE' },
      });
    });

    it('rejects an invalid transition with 409 and a clear error, and saves nothing', async () => {
      repository.findEntityById.mockResolvedValue(entity('RECIBIDA'));

      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ status: 'ATENDIDA' })
        .expect(409);

      expect(response.body as ErrorBody).toMatchObject({
        statusCode: 409,
        code: 'INVALID_STATUS_TRANSITION',
        message: 'No se puede pasar una solicitud de Recibida a Atendida',
      });
      expect(repository.saveStatusChange).not.toHaveBeenCalled();
    });

    it('rejects any change of a closed request with 409', async () => {
      repository.findEntityById.mockResolvedValue(entity('CERRADA'));

      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ status: 'DISPONIBLE' })
        .expect(409);

      expect((response.body as ErrorBody).code).toBe(
        'INVALID_STATUS_TRANSITION',
      );
    });

    it('answers 409 REQUEST_STATUS_CONFLICT when someone else changed it first', async () => {
      repository.saveStatusChange.mockRejectedValue(
        new RequestStatusConflictError(),
      );

      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ status: 'ATENDIDA' })
        .expect(409);

      expect((response.body as ErrorBody).code).toBe('REQUEST_STATUS_CONFLICT');
    });

    it('answers 404 when the request does not exist', async () => {
      repository.findEntityById.mockResolvedValue(null);

      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ status: 'ATENDIDA' })
        .expect(404);

      expect((response.body as ErrorBody).code).toBe('REQUEST_NOT_FOUND');
      expect(repository.saveStatusChange).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a UUID with 400', async () => {
      await request(server)
        .patch(statusPath('no-es-uuid'))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ status: 'ATENDIDA' })
        .expect(400);
      expect(repository.findEntityById).not.toHaveBeenCalled();
    });

    it.each([
      {},
      { status: 'ROTA' },
      { status: 'RECIBIDA' },
      // Rejecting needs a reason: HU-16
      { status: 'RECHAZADA', comment: 'Material no localizado' },
      // Only reached by scheduling an appointment: HU-18
      { status: 'AGENDADA' },
      { status: 'ATENDIDA', comment: 'a'.repeat(501) },
      // The responsible always comes from the token
      { status: 'ATENDIDA', changedBy: 'otro-usuario' },
    ])('rejects the body %j with 400 and changes nothing', async (body) => {
      const response = await request(server)
        .patch(statusPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send(body)
        .expect(400);

      expect((response.body as ErrorBody).code).toBe('VALIDATION_ERROR');
      expect(repository.findEntityById).not.toHaveBeenCalled();
      expect(repository.saveStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('POST /requests/:id/appointments (schedule, HU-18)', () => {
    const REQUEST_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';
    const appointmentsPath = (id: string) =>
      `${REQUESTS_PATH}/${id}/appointments`;
    // 2026-11-20 is a Friday, 2026-11-21 a Saturday and 2026-11-22 a Sunday
    const FRIDAY = '2026-11-20';

    interface ScheduleBody {
      id: string;
      status: string;
      allowedTransitions: string[];
      appointment: {
        date: string;
        serviceHours: { opensAt: string; closesAt: string };
        status: string;
        requester: { id: string; name: string };
        materials: { id: string; catalogCode: string; title: string }[];
      };
      statusChange: { previousStatus: string; newStatus: string };
    }

    const entity = (
      status: Request['status'],
      deliveryMode: Request['deliveryMode'] = 'PRESENCIAL',
    ) => new Request({ id: REQUEST_ID, status, deliveryMode });

    beforeEach(() => {
      repository.findEntityById.mockReset();
      repository.findEntityById.mockResolvedValue(entity('DISPONIBLE'));
      repository.saveAppointment.mockReset();
      repository.saveAppointment.mockImplementation(
        (change: StatusChange, date: Date): Promise<SavedAppointment> =>
          Promise.resolve({
            id: 'appointment-1',
            date,
            status: 'PROGRAMADA',
            requester: {
              id: 'requester-1',
              firstName: 'Juan',
              middleName: null,
              lastName: 'Pérez',
              secondLastName: null,
            },
            materials: [
              { id: 'material-1', catalogCode: 'AHB-001', title: 'Actas' },
            ],
            statusChange: {
              previousStatus: change.previousStatus,
              newStatus: change.newStatus,
              changedAt: change.changedAt,
              comment: change.comment,
              changedBy: {
                id: change.changedBy,
                firstName: 'Ana',
                middleName: null,
                lastName: 'Gómez',
                secondLastName: null,
              },
            },
          }),
      );
    });

    it('rejects a request without an access token with 401', async () => {
      await request(server)
        .post(appointmentsPath(REQUEST_ID))
        .send({ date: FRIDAY })
        .expect(401);
      expect(repository.saveAppointment).not.toHaveBeenCalled();
    });

    it('rejects a PUBLICO user with 403 and schedules nothing', async () => {
      const response = await request(server)
        .post(appointmentsPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .send({ date: FRIDAY })
        .expect(403);

      expect((response.body as ErrorBody).code).toBe('FORBIDDEN');
      expect(repository.findEntityById).not.toHaveBeenCalled();
      expect(repository.saveAppointment).not.toHaveBeenCalled();
    });

    it.each<UserRole>(['PERSONAL', 'ADMIN'])(
      'lets %s schedule a DISPONIBLE request: it becomes AGENDADA',
      async (role) => {
        const response = await request(server)
          .post(appointmentsPath(REQUEST_ID))
          .set('Authorization', `Bearer ${accessToken(role, 'staff-1')}`)
          .send({ date: FRIDAY })
          .expect(201);

        const body = response.body as ScheduleBody;
        expect(body).toMatchObject({
          id: REQUEST_ID,
          status: 'AGENDADA',
          allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
          appointment: {
            date: FRIDAY,
            serviceHours: { opensAt: '08:00', closesAt: '17:00' },
            status: 'PROGRAMADA',
            requester: { id: 'requester-1', name: 'Juan Pérez' },
            materials: [
              { id: 'material-1', catalogCode: 'AHB-001', title: 'Actas' },
            ],
          },
          statusChange: { previousStatus: 'DISPONIBLE', newStatus: 'AGENDADA' },
        });
        const [change, date] = repository.saveAppointment.mock.calls[0] as [
          StatusChange,
          Date,
        ];
        // The responsible comes from the token
        expect(change.changedBy).toBe('staff-1');
        expect(date).toEqual(new Date(`${FRIDAY}T00:00:00.000Z`));
      },
    );

    it('gives the Saturday service hours (9:00-13:00)', async () => {
      const response = await request(server)
        .post(appointmentsPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ date: '2026-11-21' })
        .expect(201);

      expect((response.body as ScheduleBody).appointment.serviceHours).toEqual({
        opensAt: '09:00',
        closesAt: '13:00',
      });
    });

    it('rejects a Sunday with 400 because the CLENA does not attend', async () => {
      const response = await request(server)
        .post(appointmentsPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ date: '2026-11-22' })
        .expect(400);

      expect(response.body as ErrorBody).toMatchObject({
        code: 'INVALID_APPOINTMENT_DATE',
        message:
          'El CLENA no atiende los domingos. Elija una fecha de lunes a sábado.',
      });
      expect(repository.saveAppointment).not.toHaveBeenCalled();
    });

    it.each<Request['status']>([
      'RECIBIDA',
      'EN_BUSQUEDA',
      'AGENDADA',
      'CERRADA',
    ])(
      'rejects a request in %s with 409 and schedules nothing',
      async (status) => {
        repository.findEntityById.mockResolvedValue(entity(status));

        const response = await request(server)
          .post(appointmentsPath(REQUEST_ID))
          .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
          .send({ date: FRIDAY })
          .expect(409);

        expect((response.body as ErrorBody).code).toBe(
          'INVALID_STATUS_TRANSITION',
        );
        expect(repository.saveAppointment).not.toHaveBeenCalled();
      },
    );

    it('rejects a request with a digital delivery with 409', async () => {
      repository.findEntityById.mockResolvedValue(
        entity('DISPONIBLE', 'DIGITAL'),
      );

      await request(server)
        .post(appointmentsPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ date: FRIDAY })
        .expect(409);
      expect(repository.saveAppointment).not.toHaveBeenCalled();
    });

    it('answers 409 REQUEST_STATUS_CONFLICT when someone else changed it first', async () => {
      repository.saveAppointment.mockRejectedValue(
        new RequestStatusConflictError(),
      );

      const response = await request(server)
        .post(appointmentsPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ date: FRIDAY })
        .expect(409);

      expect((response.body as ErrorBody).code).toBe('REQUEST_STATUS_CONFLICT');
    });

    it('answers 404 when the request does not exist', async () => {
      repository.findEntityById.mockResolvedValue(null);

      const response = await request(server)
        .post(appointmentsPath(REQUEST_ID))
        .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
        .send({ date: FRIDAY })
        .expect(404);

      expect((response.body as ErrorBody).code).toBe('REQUEST_NOT_FOUND');
    });

    it.each([{}, { date: '20/11/2026' }, { date: FRIDAY, startAt: '08:00' }])(
      'rejects the body %j with 400 and schedules nothing',
      async (body) => {
        await request(server)
          .post(appointmentsPath(REQUEST_ID))
          .set('Authorization', `Bearer ${accessToken('PERSONAL')}`)
          .send(body)
          .expect(400);
        expect(repository.saveAppointment).not.toHaveBeenCalled();
      },
    );
  });

  describe('GET /requests/mine (my requests, HU-11)', () => {
    it('rejects a request without an access token with 401', async () => {
      await request(server).get(MINE_PATH).expect(401);
      expect(repository.listByRequesterUser).not.toHaveBeenCalled();
    });

    it.each<UserRole>(['PERSONAL', 'ADMIN'])(
      'rejects a %s user with 403 and does not query',
      async (role) => {
        const response = await request(server)
          .get(MINE_PATH)
          .set('Authorization', `Bearer ${accessToken(role)}`)
          .expect(403);

        expect(response.body as ErrorBody).toMatchObject({
          statusCode: 403,
          code: 'FORBIDDEN',
        });
        expect(repository.listByRequesterUser).not.toHaveBeenCalled();
      },
    );

    it('lets a PUBLICO user list with the default order and page', async () => {
      await request(server)
        .get(MINE_PATH)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .expect(200, { items: [], page: 1, limit: 20, total: 0 });

      expect(repository.listByRequesterUser).toHaveBeenCalledWith('user-1', {
        status: undefined,
        sort: 'registeredAt',
        order: 'desc',
        page: 1,
        limit: 20,
      });
      // "mine" is its own route, not the staff list
      expect(repository.list).not.toHaveBeenCalled();
    });

    it('only asks for the requests of the user in the token', async () => {
      await request(server)
        .get(MINE_PATH)
        .set('Authorization', `Bearer ${accessToken('PUBLICO', 'user-2')}`)
        .expect(200);

      expect(repository.listByRequesterUser).toHaveBeenCalledTimes(1);
      expect(repository.listByRequesterUser).toHaveBeenCalledWith(
        'user-2',
        expect.anything(),
      );
    });

    it('passes the status filter, the order and the page', async () => {
      await request(server)
        .get(MINE_PATH)
        .query({
          status: 'AGENDADA',
          sort: 'desiredDate',
          order: 'asc',
          page: 2,
          limit: 5,
        })
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .expect(200);

      expect(repository.listByRequesterUser).toHaveBeenCalledWith('user-1', {
        status: 'AGENDADA',
        sort: 'desiredDate',
        order: 'asc',
        page: 2,
        limit: 5,
      });
    });

    it('returns tracking code, registration date and status, without the requester data', async () => {
      repository.listByRequesterUser.mockResolvedValueOnce({
        items: [
          {
            id: 'request-1',
            trackingCode: 'SOL-2026-00001',
            status: 'AGENDADA',
            deliveryMode: 'PRESENCIAL',
            desiredDate: new Date('2026-12-01T00:00:00.000Z'),
            registeredAt: new Date('2026-11-10T15:00:00.000Z'),
            requester: {
              firstName: 'Ana',
              middleName: null,
              lastName: 'Pérez',
              secondLastName: null,
              email: 'ana@mail.com',
            },
            materials: [
              { id: 'material-1', catalogCode: 'TH-DOC-0001', title: 'Acta' },
            ],
          },
        ],
        total: 1,
      });

      const response = await request(server)
        .get(MINE_PATH)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .expect(200);

      const body = response.body as { items: Record<string, unknown>[] };
      expect(body.items[0]).toEqual({
        id: 'request-1',
        trackingCode: 'SOL-2026-00001',
        status: 'AGENDADA',
        deliveryMode: 'PRESENCIAL',
        desiredDate: '2026-12-01',
        registeredAt: '2026-11-10T15:00:00.000Z',
        materials: [
          { id: 'material-1', catalogCode: 'TH-DOC-0001', title: 'Acta' },
        ],
      });
    });

    it.each([
      { status: 'ROTA' },
      { sort: 'status' },
      { limit: 1000 },
      // Staff filters do not apply to my own requests
      { requester: 'juan' },
      { material: 'cabildo' },
      { desiredFrom: '2026-12-01' },
    ])('rejects invalid parameters %j with 400', async (query) => {
      await request(server)
        .get(MINE_PATH)
        .query(query)
        .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
        .expect(400);
      expect(repository.listByRequesterUser).not.toHaveBeenCalled();
    });
  });
});
