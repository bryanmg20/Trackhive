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
  email: string;
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
}

describe('API versionada (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY)
      .useValue(new InMemoryUserRepository())
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

  it('publica el módulo de ejemplo bajo /api/v1', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ email: 'demo@trackhive.test' })
      .expect(201);

    const body = response.body as CreatedUserBody;
    expect(body.email).toBe('demo@trackhive.test');
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
  });

  it('rechaza entradas inválidas con el formato uniforme', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ email: 'no-es-un-correo' })
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

  it('rechaza campos no declarados en el DTO', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({ email: 'demo@trackhive.test', role: 'ADMIN' })
      .expect(400);

    const body = response.body as ErrorBody;
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toEqual([
      {
        field: 'role',
        messages: ['property role should not exist'],
      },
    ]);
  });

  it('no expone las rutas sin el prefijo global', async () => {
    await request(server).post('/users').send({}).expect(404);
  });

  it('documenta los endpoints en Swagger', async () => {
    await request(server)
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/);

    const response = await request(server).get('/docs-json').expect(200);

    const body = response.body as { paths?: Record<string, unknown> };
    expect(body.paths).toHaveProperty('/api/v1/users');
  });
});
