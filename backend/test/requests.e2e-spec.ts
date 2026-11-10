import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { REQUEST_REPOSITORY } from '../src/requests/application/tokens';
import {
  addBusinessDays,
  todayInBogota,
} from '../src/requests/domain/desired-date';
import type { UserRole } from '../src/users/domain/user-role';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const REQUESTS_PATH = '/api/v1/requests';
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

  const accessToken = (role: UserRole) =>
    jwt.sign(
      { sub: 'user-1', role },
      { secret: ACCESS_SECRET, expiresIn: 900 },
    );

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
});
