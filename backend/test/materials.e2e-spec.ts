import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { MATERIAL_REPOSITORY } from '../src/materials/application/tokens';
import { Material } from '../src/materials/domain/entities/material.entity';
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

describe('Change material status (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const jwt = new JwtService();
  const MATERIAL_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';
  const statusPath = (id: string) => `${MATERIALS_PATH}/${id}/status`;
  const tokenFor = (role: string) =>
    jwt.sign(
      { sub: 'user-1', role },
      { secret: ACCESS_SECRET, expiresIn: 900 },
    );

  const material = new Material({
    id: MATERIAL_ID,
    catalogCode: 'AHM-DOC-0001',
    title: 'Acta del Cabildo de 1810',
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Actas del Cabildo',
    publicationDate: null,
    publisher: null,
    location: { depot: 'D-01', shelf: 'E-12', box: 'C-034' },
    status: 'DISPONIBLE',
    createdAt: new Date('2026-11-08T00:00:00Z'),
    updatedAt: new Date('2026-11-08T00:00:00Z'),
  });
  const saveStatusChange = jest.fn(() => Promise.resolve());

  beforeAll(async () => {
    process.env.JWT_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MATERIAL_REPOSITORY)
      .useValue({
        search: () => Promise.resolve({ items: [], total: 0 }),
        findById: (id: string) =>
          Promise.resolve(id === MATERIAL_ID ? material : null),
        saveStatusChange,
      })
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
    saveStatusChange.mockClear();
  });

  it('rejects a request without an access token with 401', async () => {
    await request(server)
      .patch(statusPath(MATERIAL_ID))
      .send({ status: 'EN_USO' })
      .expect(401);
  });

  it('rejects a PUBLICO user with 403 and saves nothing', async () => {
    await request(server)
      .patch(statusPath(MATERIAL_ID))
      .set('Authorization', `Bearer ${tokenFor('PUBLICO')}`)
      .send({ status: 'EN_USO' })
      .expect(403);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'lets %s change the status with an optional reason',
    async (role) => {
      const response = await request(server)
        .patch(statusPath(MATERIAL_ID))
        .set('Authorization', `Bearer ${tokenFor(role)}`)
        .send({ status: 'EN_RESTAURACION', reason: 'Humedad en la caja' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: MATERIAL_ID,
        status: 'EN_RESTAURACION',
      });
      expect(saveStatusChange).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts a change without a reason', async () => {
    await request(server)
      .patch(statusPath(MATERIAL_ID))
      .set('Authorization', `Bearer ${tokenFor('PERSONAL')}`)
      .send({ status: 'EN_USO' })
      .expect(200);
  });

  it('rejects a status that does not exist with 400', async () => {
    await request(server)
      .patch(statusPath(MATERIAL_ID))
      .set('Authorization', `Bearer ${tokenFor('PERSONAL')}`)
      .send({ status: 'ROTO' })
      .expect(400);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });

  it('rejects an id that is not a UUID with 400', async () => {
    await request(server)
      .patch(statusPath('no-es-uuid'))
      .set('Authorization', `Bearer ${tokenFor('PERSONAL')}`)
      .send({ status: 'EN_USO' })
      .expect(400);
  });

  it('answers 404 when the material does not exist', async () => {
    await request(server)
      .patch(statusPath('00000000-0000-4000-8000-000000000000'))
      .set('Authorization', `Bearer ${tokenFor('PERSONAL')}`)
      .send({ status: 'EN_USO' })
      .expect(404);
  });
});
