import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/tokens';
import { MAIL_SENDER } from '../src/notifications/application/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import { USER_REPOSITORY } from '../src/users/application/tokens';
import { User } from '../src/users/domain/entities/user.entity';
import type { UserRole } from '../src/users/domain/user-role';
import { FakeMailSender } from './fakes/fake-mail-sender';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from './fakes/in-memory-user.repository';

const ACCESS_SECRET = 'e2e-access-secret';
const TEST_EMAIL_PATH = '/api/v1/notifications/test-email';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

describe('Test email (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let mailSender: FakeMailSender;
  const jwt = new JwtService();

  const accessToken = (userId: string, role: UserRole): string =>
    jwt.sign({ sub: userId, role }, { secret: ACCESS_SECRET, expiresIn: 900 });

  const buildUser = (id: string, email: string, role: UserRole): User =>
    new User({
      id,
      fullName: 'Persona Demo',
      email,
      passwordHash: 'hashed',
      role,
      active: true,
    });

  const sendTestEmail = (token?: string) => {
    const call = request(server).post(TEST_EMAIL_PATH);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    const users = new InMemoryUserRepository();
    await users.save(buildUser('admin-1', 'admin@trackhive.test', 'ADMIN'));
    await users.save(buildUser('staff-1', 'staff@trackhive.test', 'PERSONAL'));
    await users.save(buildUser('public-1', 'ana@trackhive.test', 'PUBLICO'));
    mailSender = new FakeMailSender();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(MAIL_SENDER)
      .useValue(mailSender)
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
    mailSender.sent.length = 0;
    mailSender.failing = false;
  });

  it('sends the test email to the administrator who asks for it', async () => {
    const response = await sendTestEmail(
      accessToken('admin-1', 'ADMIN'),
    ).expect(200);

    expect(response.body).toEqual({ sentTo: 'admin@trackhive.test' });
    expect(mailSender.sent).toEqual([
      expect.objectContaining({
        to: 'admin@trackhive.test',
        subject: 'Correo de prueba de Trackhive',
      }),
    ]);
  });

  it.each([
    ['staff', 'staff-1', 'PERSONAL'],
    ['a public user', 'public-1', 'PUBLICO'],
  ] as const)('rejects %s with 403', async (_who, userId, role) => {
    const response = await sendTestEmail(accessToken(userId, role)).expect(403);

    expect((response.body as ErrorBody).code).toBe('FORBIDDEN');
    expect(mailSender.sent).toHaveLength(0);
  });

  it('rejects a request without an access token with 401', async () => {
    await sendTestEmail().expect(401);

    expect(mailSender.sent).toHaveLength(0);
  });

  it('answers 502 when the mail server fails', async () => {
    mailSender.failing = true;

    const response = await sendTestEmail(
      accessToken('admin-1', 'ADMIN'),
    ).expect(502);

    expect(response.body as ErrorBody).toMatchObject({
      statusCode: 502,
      code: 'MAIL_DELIVERY_FAILED',
      message: 'No se pudo enviar el correo. Revisa la configuración SMTP',
    });
  });

  it('documents the endpoint in Swagger', async () => {
    const response = await request(server).get('/docs-json').expect(200);

    const body = response.body as { paths?: Record<string, unknown> };
    expect(body.paths).toHaveProperty(TEST_EMAIL_PATH);
  });
});
