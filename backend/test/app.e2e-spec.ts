import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { USER_REPOSITORY } from '../src/users/application/tokens';
import { User } from '../src/users/domain/entities/user.entity';
import { IUserRepository } from '../src/users/domain/repositories/user.repository';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';

interface CreatedUserBody {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
  role: string;
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Array<{ field: string; messages: string[] }>;
  timestamp: string;
  path: string;
}

class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  save(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  findAll(): Promise<User[]> {
    return Promise.resolve([...this.users.values()]);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === email,
    );
    return Promise.resolve(user ?? null);
  }
}

const validRegistration = (email = 'ana@trackhive.test') => ({
  firstName: 'Ana',
  middleName: 'María',
  lastName: 'Pérez',
  secondLastName: 'Gómez',
  email,
  password: 'secreto123',
  acceptedPrivacy: true,
  privacyPolicyVersion: '1.0',
});

describe('Versioned API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let repository: InMemoryUserRepository;
  const queryRaw = jest.fn().mockResolvedValue([{ 1: 1 }]);

  beforeAll(async () => {
    repository = new InMemoryUserRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY)
      .useValue(repository)
      // The startup purge of expired tokens (HU-3.1) needs a repository
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(new InMemoryRefreshTokenRepository())
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a public account under /api/v1', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send(validRegistration())
      .expect(201);

    const body = response.body as CreatedUserBody;
    expect(body).toMatchObject({
      firstName: 'Ana',
      middleName: 'María',
      lastName: 'Pérez',
      secondLastName: 'Gómez',
      email: 'ana@trackhive.test',
      role: 'PUBLICO',
    });
    expect(body).not.toHaveProperty('fullName');
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');

    const stored = await repository.findByEmail('ana@trackhive.test');
    expect(stored?.passwordHash).toMatch(/^\$argon2/);
    expect(stored?.passwordHash).not.toBe('secreto123');
    expect(stored?.privacyPolicyAcceptedAt).toBeInstanceOf(Date);
    expect(stored?.privacyPolicyVersion).toBe('1.0');
  });

  it('rejects a registration without privacy consent', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({
        ...validRegistration('sin-consentimiento@trackhive.test'),
        acceptedPrivacy: false,
      })
      .expect(400);

    expect((response.body as ErrorBody).details).toEqual([
      {
        field: 'acceptedPrivacy',
        messages: ['Debe aceptar el aviso de privacidad para crear la cuenta'],
      },
    ]);
    expect(
      await repository.findByEmail('sin-consentimiento@trackhive.test'),
    ).toBeNull();
  });

  it('rejects a registration with an outdated privacy notice version', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({
        ...validRegistration('version-vencida@trackhive.test'),
        privacyPolicyVersion: '0.9',
      })
      .expect(400);

    expect((response.body as ErrorBody).details).toEqual([
      {
        field: 'privacyPolicyVersion',
        messages: ['Debe aceptar la versión vigente del aviso de privacidad'],
      },
    ]);
  });

  it('registers with only the required name fields', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({
        firstName: 'Luis',
        lastName: 'Rojas',
        email: 'solo-obligatorios@trackhive.test',
        password: 'secreto123',
        acceptedPrivacy: true,
        privacyPolicyVersion: '1.0',
      })
      .expect(201);

    expect(response.body as CreatedUserBody).toMatchObject({
      firstName: 'Luis',
      middleName: null,
      lastName: 'Rojas',
      secondLastName: null,
    });
  });

  it('stores blank optional name fields as null', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({
        ...validRegistration('opcionales-vacios@trackhive.test'),
        middleName: '   ',
        secondLastName: '',
      })
      .expect(201);

    expect(response.body as CreatedUserBody).toMatchObject({
      middleName: null,
      secondLastName: null,
    });
    const stored = await repository.findByEmail(
      'opcionales-vacios@trackhive.test',
    );
    expect(stored?.middleName).toBeNull();
    expect(stored?.secondLastName).toBeNull();
  });

  it('rejects a blank required name field and names it', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ ...validRegistration(), lastName: '   ' })
      .expect(400);

    expect((response.body as ErrorBody).details).toEqual([
      {
        field: 'lastName',
        messages: ['El primer apellido es obligatorio'],
      },
    ]);
  });

  it('rejects a registration without the first name', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ ...validRegistration(), firstName: undefined })
      .expect(400);

    const fields = (response.body as ErrorBody).details?.map(
      (detail) => detail.field,
    );
    expect(fields).toEqual(['firstName']);
  });

  it('rejects a name field longer than 40 characters', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ ...validRegistration(), middleName: 'a'.repeat(41) })
      .expect(400);

    expect((response.body as ErrorBody).details).toEqual([
      {
        field: 'middleName',
        messages: ['El segundo nombre no puede superar los 40 caracteres'],
      },
    ]);
  });

  it('normalizes the email to lowercase', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send(validRegistration('  MAYUSCULAS@TRACKHIVE.TEST '))
      .expect(201);

    expect((response.body as CreatedUserBody).email).toBe(
      'mayusculas@trackhive.test',
    );
  });

  it('rejects an email that is already registered', async () => {
    const email = 'duplicado@trackhive.test';

    await request(server)
      .post('/api/v1/users')
      .send(validRegistration(email))
      .expect(201);

    const response = await request(server)
      .post('/api/v1/users')
      .send(validRegistration(email.toUpperCase()))
      .expect(409);

    expect(response.body as ErrorBody).toMatchObject({
      statusCode: 409,
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Ya existe una cuenta con ese correo',
      path: '/api/v1/users',
    });
  });

  it('rejects invalid input with the uniform format', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ ...validRegistration(), email: 'no-es-un-correo' })
      .expect(400);

    const body = response.body as ErrorBody;
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'La petición contiene datos inválidos',
      path: '/api/v1/users',
    });
    expect(body.details).toEqual([
      {
        field: 'email',
        messages: ['El correo no tiene un formato válido'],
      },
    ]);
    expect(typeof body.timestamp).toBe('string');
  });

  it('rejects a password shorter than 8 characters', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ ...validRegistration(), password: 'corta' })
      .expect(400);

    expect((response.body as ErrorBody).details).toEqual([
      {
        field: 'password',
        messages: ['La contraseña debe tener al menos 8 caracteres'],
      },
    ]);
  });

  it('rejects fields not declared in the DTO', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ ...validRegistration(), role: 'ADMIN' })
      .expect(400);

    const body = response.body as ErrorBody;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toEqual([
      {
        field: 'role',
        messages: ['El campo role no está permitido.'],
      },
    ]);
  });

  it('does not expose routes without the global prefix', async () => {
    await request(server).post('/users').send({}).expect(404);
  });

  it('documents the endpoints in Swagger', async () => {
    await request(server)
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/);

    const response = await request(server).get('/docs-json').expect(200);

    const body = response.body as {
      paths?: Record<string, unknown>;
      components: {
        schemas: Record<
          string,
          {
            required?: string[];
            properties: Record<string, { nullable?: boolean }>;
          }
        >;
      };
    };
    expect(body.paths).toHaveProperty('/api/v1/users');

    // The four name fields, with only the first name and last name required
    const nameFields = [
      'firstName',
      'middleName',
      'lastName',
      'secondLastName',
    ];
    const createUser = body.components.schemas.CreateUserDto;
    expect(Object.keys(createUser.properties)).toEqual(
      expect.arrayContaining(nameFields),
    );
    expect(createUser.properties).not.toHaveProperty('fullName');
    expect(createUser.required).toEqual(
      expect.arrayContaining([
        'firstName',
        'lastName',
        'acceptedPrivacy',
        'privacyPolicyVersion',
      ]),
    );
    expect(createUser.required).not.toContain('middleName');
    expect(createUser.required).not.toContain('secondLastName');

    const userResponse = body.components.schemas.UserResponseDto;
    expect(userResponse.properties).not.toHaveProperty('fullName');
    expect(userResponse.properties.middleName.nullable).toBe(true);
    expect(userResponse.properties.secondLastName.nullable).toBe(true);
  });

  it('reports health without an access token', async () => {
    await request(server).get('/api/v1/health').expect(200).expect({
      status: 'ok',
      database: 'up',
    });
  });

  it('reports the database as down when it takes longer than 3 s', async () => {
    // A query that never answers, as with a hung database
    queryRaw.mockReturnValueOnce(new Promise(() => {}));

    const startedAt = Date.now();
    await request(server).get('/api/v1/health').expect(200).expect({
      status: 'degraded',
      database: 'down',
    });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2900);
  }, 10_000);
});
