import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { USER_REPOSITORY } from '../src/users/application/tokens';
import { User } from '../src/users/domain/entities/user.entity';
import { IUserRepository } from '../src/users/domain/repositories/user.repository';

interface CreatedUserBody {
  id: string;
  fullName: string;
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
  fullName: 'Ana Pérez',
  email,
  password: 'secreto123',
});

describe('Versioned API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let repository: InMemoryUserRepository;

  beforeAll(async () => {
    repository = new InMemoryUserRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY)
      .useValue(repository)
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

  it('registers a public account under /api/v1', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send(validRegistration())
      .expect(201);

    const body = response.body as CreatedUserBody;
    expect(body).toMatchObject({
      fullName: 'Ana Pérez',
      email: 'ana@trackhive.test',
      role: 'PUBLICO',
    });
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');

    const stored = await repository.findByEmail('ana@trackhive.test');
    expect(stored?.passwordHash).toMatch(/^\$argon2/);
    expect(stored?.passwordHash).not.toBe('secreto123');
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

    const body = response.body as { paths?: Record<string, unknown> };
    expect(body.paths).toHaveProperty('/api/v1/users');
  });
});
