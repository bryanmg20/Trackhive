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
} from '../src/requests/application/use-cases/create-request.use-case';
import type { UserRole } from '../src/users/domain/user-role';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const REQUESTS_PATH = '/api/v1/requests';

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
    repository.create.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

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
