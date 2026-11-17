import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { Requester } from '../src/requests/domain/entities/requester.entity';
import { RequesterResolver } from '../src/requests/application/services/requester-resolver';
import {
  REQUESTER_REPOSITORY,
  REQUEST_QUERY_SERVICE,
  REQUEST_REPOSITORY,
  TRACKING_CODE_GENERATOR,
} from '../src/requests/application/tokens';
import {
  addBusinessDays,
  todayInBogota,
} from '../src/requests/domain/value-objects/desired-date';
import {
  ACCOUNT_REGISTRATION,
  USER_REPOSITORY,
} from '../src/users/application/tokens';
import { User } from '../src/users/domain/entities/user.entity';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../src/users/domain/policies/privacy-policy';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from './fakes/in-memory-user.repository';

const PATH = '/api/v1/users/me/profile';
const SECRET = 'profile-e2e-secret';
const data = {
  municipality: 'Barranquilla',
  ageRange: '18-28',
  populationGroup: 'PREFIERO_NO_RESPONDER',
};

describe('Requester characterization and own profile (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const users = new InMemoryUserRepository();
  const requesters = new Map<string, Requester>();
  const profiles = {
    findByUserId: (id: string) =>
      Promise.resolve(
        [...requesters.values()].find((value) => value.userId === id) ?? null,
      ),
    findByEmail: (email: string) =>
      Promise.resolve(
        [...requesters.values()].find((value) => value.props.email === email) ??
          null,
      ),
    save: (value: Requester) => {
      requesters.set(value.id, value);
      return Promise.resolve();
    },
  };
  const jwt = new JwtService();
  const token = (id: string, role = 'PUBLICO') =>
    jwt.sign({ sub: id, role }, { secret: SECRET });

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    process.env.JWT_REFRESH_SECRET = 'profile-refresh-secret';
    for (const role of ['PUBLICO', 'PERSONAL', 'ADMIN'] as const) {
      await users.save(
        new User({
          id: role,
          firstName: 'Persona',
          lastName: 'Prueba',
          email: `${role.toLowerCase()}@example.com`,
          passwordHash: 'hash',
          role,
          active: true,
        }),
      );
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(REQUESTER_REPOSITORY)
      .useValue(profiles)
      .overrideProvider(ACCOUNT_REGISTRATION)
      .useValue({
        save: async (user: User, requester: Requester) => {
          await users.save(user);
          await profiles.save(requester);
        },
      })
      .overrideProvider(REQUEST_REPOSITORY)
      .useValue({ save: async () => {} })
      .overrideProvider(REQUEST_QUERY_SERVICE)
      .useValue({ findMissingMaterialIds: () => Promise.resolve([]) })
      .overrideProvider(TRACKING_CODE_GENERATOR)
      .useValue({ next: () => Promise.resolve('SOL-2026-12345') })
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

  it.each(['get', 'patch'] as const)(
    'requires an access token for %s',
    async (method) => {
      await request(server)[method](PATH).send(data).expect(401);
    },
  );

  it.each(['PUBLICO', 'PERSONAL', 'ADMIN'])(
    'allows %s to read and edit their own profile without role restrictions',
    async (role) => {
      await request(server)
        .patch(PATH)
        .set('Authorization', `Bearer ${token(role, role)}`)
        .send(data)
        .expect(200);
      const response = await request(server)
        .get(PATH)
        .set('Authorization', `Bearer ${token(role, role)}`)
        .expect(200);
      expect(response.body).toMatchObject(data);
      expect(response.body).not.toHaveProperty('passwordHash');
    },
  );

  it('returns null characterization for a legacy account without creating a requester on GET', async () => {
    const legacy = new User({
      id: 'legacy',
      firstName: 'Anterior',
      lastName: 'Prueba',
      email: 'legacy@example.com',
      passwordHash: 'hash',
      role: 'PUBLICO',
      active: true,
    });
    await users.save(legacy);
    const before = requesters.size;
    const response = await request(server)
      .get(PATH)
      .set('Authorization', `Bearer ${token('legacy')}`)
      .expect(200);
    expect(response.body).toMatchObject({
      municipality: null,
      ageRange: null,
      populationGroup: null,
    });
    expect(requesters.size).toBe(before);
    await request(server)
      .patch(PATH)
      .set('Authorization', `Bearer ${token('legacy')}`)
      .send({ municipality: 'Soledad', ageRange: '60+' })
      .expect(200);
    expect(requesters.size).toBe(before + 1);
  });

  it('does not allow selecting another user or changing account attributes', async () => {
    await request(server)
      .patch(PATH)
      .set('Authorization', `Bearer ${token('PUBLICO')}`)
      .send({ ...data, userId: 'ADMIN' })
      .expect(400);
    await request(server)
      .patch(PATH)
      .set('Authorization', `Bearer ${token('PUBLICO')}`)
      .send({ ...data, role: 'ADMIN' })
      .expect(400);
    const before = await profiles.findByUserId('ADMIN');
    await request(server)
      .patch(PATH)
      .set('Authorization', `Bearer ${token('PUBLICO')}`)
      .send({ municipality: 'Soledad', ageRange: '29-59' })
      .expect(200);
    expect(await profiles.findByUserId('ADMIN')).toEqual(before);
  });

  it.each([
    { ...data, municipality: '   ' },
    { ...data, ageRange: '18' },
    { ...data, populationGroup: 'OTHER' },
  ])(
    'rejects invalid values without updating the profile: %j',
    async (invalid) => {
      const before = await profiles.findByUserId('PUBLICO');
      await request(server)
        .patch(PATH)
        .set('Authorization', `Bearer ${token('PUBLICO')}`)
        .send(invalid)
        .expect(400);
      expect(await profiles.findByUserId('PUBLICO')).toEqual(before);
    },
  );

  it('creates the characterized requester during public registration and reuses it for later requests', async () => {
    const registration = await request(server)
      .post('/api/v1/users')
      .send({
        ...data,
        firstName: 'Ana',
        lastName: 'Prueba',
        email: 'registration@example.com',
        password: 'secreto123',
        acceptedPrivacy: true,
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      })
      .expect(201);
    const account = registration.body as { id: string };
    const response = await request(server)
      .get(PATH)
      .set('Authorization', `Bearer ${token(account.id)}`)
      .expect(200);
    expect(response.body).toMatchObject(data);
    const before = requesters.size;
    const resolver = app.get(RequesterResolver);
    const first = await resolver.forUser(account.id);
    const second = await resolver.forUser(account.id);
    expect(first.id).toBe(second.id);
    expect(requesters.size).toBe(before);
    expect(first.props.privacyPolicyVersion).toBe(
      CURRENT_PRIVACY_POLICY_VERSION,
    );
  });

  it('requires characterization only for new visitors registered by staff and reuses it by email', async () => {
    const body = {
      materialIds: ['c3f6c8f0-1c2b-4e3d-8f4a-123456789abc'],
      reason: 'Consulta de prueba para caracterización',
      desiredDate: addBusinessDays(todayInBogota(), 10)
        .toISOString()
        .slice(0, 10),
      deliveryMode: 'PRESENCIAL',
      requester: {
        email: 'visitor73@example.com',
        firstName: 'Visitante',
        lastName: 'Prueba',
      },
    };
    await request(server)
      .post('/api/v1/requests/on-behalf')
      .set('Authorization', `Bearer ${token('PERSONAL', 'PERSONAL')}`)
      .send(body)
      .expect(400);
    await request(server)
      .post('/api/v1/requests/on-behalf')
      .set('Authorization', `Bearer ${token('PERSONAL', 'PERSONAL')}`)
      .send({ ...body, requester: { ...body.requester, ...data } })
      .expect(201);
    const stored = await profiles.findByEmail(body.requester.email);
    expect(stored?.props).toMatchObject(data);
    const before = requesters.size;
    await request(server)
      .post('/api/v1/requests/on-behalf')
      .set('Authorization', `Bearer ${token('PERSONAL', 'PERSONAL')}`)
      .send({ ...body, requester: { email: body.requester.email } })
      .expect(201);
    expect(requesters.size).toBe(before);
    expect(await profiles.findByEmail(body.requester.email)).toEqual(stored);
  });
});
