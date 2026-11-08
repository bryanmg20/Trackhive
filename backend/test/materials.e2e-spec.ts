import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { MATERIAL_REPOSITORY } from '../src/materials/application/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const MATERIALS_PATH = '/api/v1/materials';

describe('Material search (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const jwt = new JwtService();

  beforeAll(async () => {
    process.env.JWT_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MATERIAL_REPOSITORY)
      .useValue({ search: () => Promise.resolve({ items: [], total: 0 }) })
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

  it('rejects a request without an access token with 401', async () => {
    await request(server).get(MATERIALS_PATH).expect(401);
  });

  it('lets a PUBLICO user search: the endpoint has no @Roles()', async () => {
    const token = jwt.sign(
      { sub: 'user-1', role: 'PUBLICO' },
      { secret: ACCESS_SECRET, expiresIn: 900 },
    );

    await request(server)
      .get(MATERIALS_PATH)
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { items: [], page: 1, limit: 20, total: 0 });
  });
});
