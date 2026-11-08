import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { Roles } from '../src/auth/presentation/decorators/roles.decorator';
import { PrismaService } from '../src/prisma/prisma.service';
import type { UserRole } from '../src/users/domain/user-role';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const STAFF_PATH = '/api/v1/e2e-staff-only';

/** Test-only endpoint: there is no real staff endpoint yet (HU-04). */
@Controller('e2e-staff-only')
class StaffOnlyController {
  @Get()
  @Roles('PERSONAL', 'ADMIN')
  get(): { ok: boolean } {
    return { ok: true };
  }
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

describe('Role-based authorization (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const jwt = new JwtService();

  const accessToken = (role: UserRole, expiresIn: number = 900) =>
    jwt.sign({ sub: 'user-1', role }, { secret: ACCESS_SECRET, expiresIn });

  beforeAll(async () => {
    process.env.JWT_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [StaffOnlyController],
    })
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

  afterAll(async () => {
    await app.close();
  });

  it.each<UserRole>(['PERSONAL', 'ADMIN'])(
    'lets %s call a staff endpoint',
    async (role) => {
      await request(server)
        .get(STAFF_PATH)
        .set('Authorization', `Bearer ${accessToken(role)}`)
        .expect(200, { ok: true });
    },
  );

  it('rejects a public user on a staff endpoint with 403', async () => {
    const response = await request(server)
      .get(STAFF_PATH)
      .set('Authorization', `Bearer ${accessToken('PUBLICO')}`)
      .expect(403);

    expect(response.body as ErrorBody).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'No tienes permiso para realizar esta acción',
    });
  });

  it('rejects a request without a token with 401', async () => {
    const response = await request(server).get(STAFF_PATH).expect(401);

    expect(response.body as ErrorBody).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Token de acceso ausente, inválido o vencido',
    });
  });

  it('rejects an expired token with 401', async () => {
    await request(server)
      .get(STAFF_PATH)
      .set('Authorization', `Bearer ${accessToken('ADMIN', -10)}`)
      .expect(401);
  });

  it('rejects a token signed with another secret with 401', async () => {
    const forged = jwt.sign(
      { sub: 'user-1', role: 'ADMIN' },
      { secret: 'not-our-secret' },
    );

    await request(server)
      .get(STAFF_PATH)
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });

  it('keeps @Public() endpoints open without a token', async () => {
    // Reaches the login use case: 400 for the empty body, not 401
    await request(server).post('/api/v1/auth/login').send({}).expect(400);
  });
});
