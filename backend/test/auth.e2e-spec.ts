import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { USER_REPOSITORY } from '../src/users/application/tokens';
import { User } from '../src/users/domain/entities/user.entity';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from './fakes/in-memory-user.repository';

const REFRESH_SECRET = 'e2e-refresh-secret';
const EMAIL = 'ana@trackhive.test';
const PASSWORD = 'secreto123';

interface TokensBody {
  accessToken: string;
  refreshToken: string;
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Array<{ field: string; messages: string[] }>;
  path: string;
}

describe('Session renewal (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let refreshTokens: InMemoryRefreshTokenRepository;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-access-secret';
    process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;

    const users = new InMemoryUserRepository();
    await users.save(
      new User({
        id: 'user-1',
        fullName: 'Ana Pérez',
        email: EMAIL,
        passwordHash: await argon2.hash(PASSWORD),
        role: 'PUBLICO',
        active: true,
      }),
    );
    refreshTokens = new InMemoryRefreshTokenRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(refreshTokens)
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

  const login = async (): Promise<TokensBody> => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    return response.body as TokensBody;
  };

  const refresh = (refreshToken: string) =>
    request(server).post('/api/v1/auth/refresh').send({ refreshToken });

  const logout = (refreshToken: string) =>
    request(server).post('/api/v1/auth/logout').send({ refreshToken });

  const expectInvalidSession = (body: unknown): void => {
    expect(body as ErrorBody).toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
      message: 'La sesión no es válida o ya expiró',
      path: '/api/v1/auth/refresh',
    });
  };

  it('stores only the hash of the refresh token issued at login', async () => {
    const { refreshToken } = await login();

    const sha256 = createHash('sha256').update(refreshToken).digest('hex');
    const stored = refreshTokens
      .findAll()
      .find((token) => token.tokenHash === sha256);
    expect(stored).toMatchObject({ userId: 'user-1', revokedAt: null });
    expect(
      refreshTokens.findAll().some((token) => token.tokenHash === refreshToken),
    ).toBe(false);
  });

  it('gives a new access token for a valid refresh token', async () => {
    const session = await login();

    const response = await refresh(session.refreshToken).expect(200);

    const body = response.body as TokensBody;
    expect(body.accessToken.split('.')).toHaveLength(3);
    expect(body.refreshToken.split('.')).toHaveLength(3);
    expect(body.refreshToken).not.toBe(session.refreshToken);
  });

  it('rejects a refresh token that was already used, and revokes the session it renewed', async () => {
    const session = await login();
    const renewed = (await refresh(session.refreshToken).expect(200))
      .body as TokensBody;

    const reuse = await refresh(session.refreshToken).expect(401);
    expectInvalidSession(reuse.body);

    // The reuse means the token was copied: the renewed session is closed too
    await refresh(renewed.refreshToken).expect(401);
  });

  it('rejects an expired refresh token', async () => {
    const expired = await new JwtService().signAsync(
      {
        sub: 'user-1',
        role: 'PUBLICO',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      { secret: REFRESH_SECRET },
    );

    const response = await refresh(expired).expect(401);

    expectInvalidSession(response.body);
  });

  it('rejects an access token sent as refresh token', async () => {
    const { accessToken } = await login();

    const response = await refresh(accessToken).expect(401);

    expectInvalidSession(response.body);
  });

  it('invalidates the refresh token on logout', async () => {
    const session = await login();

    await logout(session.refreshToken).expect(204);

    const response = await refresh(session.refreshToken).expect(401);
    expectInvalidSession(response.body);
  });

  it('answers logout with 204 when the session is already closed', async () => {
    const session = await login();
    await logout(session.refreshToken).expect(204);

    await logout(session.refreshToken).expect(204);
  });

  it('rejects a body without a JWT with the uniform format', async () => {
    const response = await refresh('no-es-un-jwt').expect(400);

    const body = response.body as ErrorBody;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toEqual([
      {
        field: 'refreshToken',
        messages: ['El refresh token no tiene un formato válido'],
      },
    ]);
  });

  it('documents the session endpoints in Swagger', async () => {
    const response = await request(server).get('/docs-json').expect(200);

    const body = response.body as { paths?: Record<string, unknown> };
    expect(body.paths).toHaveProperty('/api/v1/auth/refresh');
    expect(body.paths).toHaveProperty('/api/v1/auth/logout');
  });
});
