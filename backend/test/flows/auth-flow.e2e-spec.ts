import { createHash } from 'crypto';
import request from 'supertest';
import {
  API,
  E2eApp,
  PASSWORD,
  bearer,
  createE2eApp,
  login,
  registrationBody,
  uniqueEmail,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/**
 * Registration and sign-in against PostgreSQL (HU-41): a public account is
 * created, signs in, uses its session, renews it and closes it, and every
 * step is checked in the database.
 */
describe('Sign-up and sign-in flow (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp();
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('registers a public account, signs in, renews the session and signs out', async () => {
    const { server, prisma } = e2e;
    const email = uniqueEmail('registro');

    // 1. Sign-up (HU-01): stored with an argon2 hash and the consent
    const created = await request(server)
      .post(`${API}/users`)
      .send(registrationBody(email.toUpperCase()))
      .expect(201);
    const { id: userId } = created.body as { id: string };
    expect(created.body).toMatchObject({ email, role: 'PUBLICO' });
    expect(created.body).not.toHaveProperty('passwordHash');

    const user = await prisma.userModel.findUniqueOrThrow({
      where: { id: userId },
      include: { requester: true },
    });
    expect(user).toMatchObject({
      email,
      role: 'PUBLICO',
      active: true,
      privacyPolicyVersion: '1.1',
    });
    expect(user.passwordHash).toMatch(/^\$argon2/);
    expect(user.privacyPolicyAcceptedAt).toBeInstanceOf(Date);
    // The requester with the characterization is created with the account
    expect(user.requester).toMatchObject({
      email,
      municipality: 'Barranquilla',
      ageRange: '18-28',
      acceptsDataProcessing: true,
    });

    // 2. Sign-in (HU-02): only the hash of the refresh token is stored
    const first = await login(server, email);
    const stored = await prisma.refreshTokenModel.findMany({
      where: { userId },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      tokenHash: sha256(first.refreshToken),
      revokedAt: null,
    });

    // 3. The access token opens the protected endpoints
    const profile = await request(server)
      .get(`${API}/users/me/profile`)
      .set('Authorization', bearer({ ...first, userId, email }))
      .expect(200);
    expect(profile.body).toMatchObject({ email, firstName: 'Ana' });

    // 4. Renewal (HU-3.1): rotates the refresh token and revokes the old one
    const renewed = await request(server)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    const second = renewed.body as { refreshToken: string };
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const old = await prisma.refreshTokenModel.findUniqueOrThrow({
      where: { tokenHash: sha256(first.refreshToken) },
    });
    expect(old.revokedAt).toBeInstanceOf(Date);

    // 5. Sign-out: the refresh token no longer renews the session
    await request(server)
      .post(`${API}/auth/logout`)
      .send({ refreshToken: second.refreshToken })
      .expect(204);
    const afterLogout = await request(server)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: second.refreshToken })
      .expect(401);
    expect((afterLogout.body as ErrorBody).code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects a second account with the same email, in any case, with 409', async () => {
    const email = uniqueEmail('duplicado');
    // The first account is sent in uppercase and with spaces: it is stored
    // trimmed and in lowercase
    const created = await request(e2e.server)
      .post(`${API}/users`)
      .send(registrationBody(`  ${email.toUpperCase()} `))
      .expect(201);
    expect(created.body).toMatchObject({ email });

    const response = await request(e2e.server)
      .post(`${API}/users`)
      .send(registrationBody(email))
      .expect(409);

    expect((response.body as ErrorBody).code).toBe('EMAIL_ALREADY_EXISTS');
    const stored = await e2e.prisma.userModel.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].email).toBe(email);
  });

  it('rejects a wrong password with 401 and issues no session', async () => {
    const email = uniqueEmail('clave');
    const created = await request(e2e.server)
      .post(`${API}/users`)
      .send(registrationBody(email))
      .expect(201);
    const { id: userId } = created.body as { id: string };

    const response = await request(e2e.server)
      .post(`${API}/auth/login`)
      .send({ email, password: `${PASSWORD}-mal` })
      .expect(401);

    expect((response.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');
    expect(
      await e2e.prisma.refreshTokenModel.count({ where: { userId } }),
    ).toBe(0);
  });

  it('rejects reusing a refresh token that was already rotated', async () => {
    const email = uniqueEmail('reuso');
    await request(e2e.server)
      .post(`${API}/users`)
      .send(registrationBody(email))
      .expect(201);
    const { refreshToken } = await login(e2e.server, email);

    await request(e2e.server)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken })
      .expect(200);
    const reused = await request(e2e.server)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken })
      .expect(401);

    expect((reused.body as ErrorBody).code).toBe('INVALID_REFRESH_TOKEN');
  });
});
