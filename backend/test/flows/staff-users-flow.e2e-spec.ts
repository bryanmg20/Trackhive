import { randomUUID } from 'crypto';
import request from 'supertest';
import {
  API,
  E2eApp,
  PASSWORD,
  Session,
  bearer,
  createE2eApp,
  login,
  signInStaffUser,
  signUpPublicUser,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

interface StaffUserBody {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
  role: string;
  active: boolean;
}

interface StaffPageBody {
  items: StaffUserBody[];
  page: number;
  limit: number;
  total: number;
}

const STAFF = `${API}/users/staff`;

/**
 * Staff accounts management against PostgreSQL (HU-05): an administrator
 * creates, lists, edits, deactivates and reactivates PERSONAL and ADMIN
 * accounts, and only ADMIN can do it.
 */
describe('Staff accounts management (e2e, PostgreSQL, HU-05)', () => {
  let e2e: E2eApp;
  let admin: Session;

  beforeAll(async () => {
    e2e = await createE2eApp();
    admin = await signInStaffUser(e2e, 'ADMIN');
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  /** Every file shares the database: the tag keeps these accounts apart. */
  const staffBody = (tag: string, overrides: Record<string, unknown> = {}) => ({
    firstName: 'Laura',
    lastName: 'Gómez',
    email: `hu05-${tag}@trackhive.test`,
    password: PASSWORD,
    ...overrides,
  });

  const createStaff = async (body: Record<string, unknown>) =>
    (
      await request(e2e.server)
        .post(STAFF)
        .set('Authorization', bearer(admin))
        .send(body)
        .expect(201)
    ).body as StaffUserBody;

  const update = (id: string, body: Record<string, unknown>) =>
    request(e2e.server)
      .patch(`${STAFF}/${id}`)
      .set('Authorization', bearer(admin))
      .send(body);

  describe('criterion 1: a new PERSONAL account is active and can sign in', () => {
    it('creates a PERSONAL account that signs in and operates as staff', async () => {
      const tag = randomUUID().slice(0, 8);
      const created = await createStaff(
        staffBody(tag, {
          email: `  HU05-${tag}@TRACKHIVE.TEST `,
          middleName: 'Sofía',
        }),
      );

      expect(created).toMatchObject({
        firstName: 'Laura',
        middleName: 'Sofía',
        email: `hu05-${tag}@trackhive.test`,
        role: 'PERSONAL',
        active: true,
      });
      expect(created).not.toHaveProperty('password');
      expect(created).not.toHaveProperty('passwordHash');

      const stored = await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: created.id },
        include: { requester: true },
      });
      expect(stored).toMatchObject({
        role: 'PERSONAL',
        active: true,
        privacyPolicyAcceptedAt: null,
        requester: null,
      });
      expect(stored.passwordHash).toMatch(/^\$argon2/);

      // The initial password works right away, and the token is a staff one
      const session = await login(e2e.server, created.email);
      await request(e2e.server)
        .get(`${API}/requests`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);
    });

    it('does not create ADMIN accounts: a role in the body is rejected with 400', async () => {
      const tag = randomUUID().slice(0, 8);

      for (const role of ['ADMIN', 'PERSONAL']) {
        const response = await request(e2e.server)
          .post(STAFF)
          .set('Authorization', bearer(admin))
          .send(staffBody(tag, { role }))
          .expect(400);
        expect(response.body).toMatchObject({
          code: 'VALIDATION_ERROR',
          details: [
            { field: 'role', messages: ['El campo role no está permitido.'] },
          ],
        });
      }

      expect(
        await e2e.prisma.userModel.count({
          where: { email: `hu05-${tag}@trackhive.test` },
        }),
      ).toBe(0);
    });

    it('rejects an email that already has an account, with 409', async () => {
      const response = await request(e2e.server)
        .post(STAFF)
        .set('Authorization', bearer(admin))
        .send(staffBody('dup', { email: admin.email.toUpperCase() }))
        .expect(409);

      expect((response.body as ErrorBody).code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('rejects fields that do not belong to a new account, with 400', async () => {
      const tag = randomUUID().slice(0, 8);

      await request(e2e.server)
        .post(STAFF)
        .set('Authorization', bearer(admin))
        .send(staffBody(tag, { active: false }))
        .expect(400);

      expect(
        await e2e.prisma.userModel.count({
          where: { email: `hu05-${tag}@trackhive.test` },
        }),
      ).toBe(0);
    });
  });

  describe('criterion 2: a deactivated account cannot sign in', () => {
    it('rejects sign-in and renewal after the deactivation, and allows them again after reactivating', async () => {
      const tag = randomUUID().slice(0, 8);
      const created = await createStaff(staffBody(tag));
      const before = await login(e2e.server, created.email);

      const deactivated = await update(created.id, { active: false }).expect(
        200,
      );
      expect((deactivated.body as StaffUserBody).active).toBe(false);
      const stored = await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored.active).toBe(false);

      const denied = await request(e2e.server)
        .post(`${API}/auth/login`)
        .send({ email: created.email, password: PASSWORD })
        .expect(401);
      expect((denied.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');

      // The session opened before the deactivation cannot be renewed either
      const renewal = await request(e2e.server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: before.refreshToken })
        .expect(401);
      expect((renewal.body as ErrorBody).code).toBe('INVALID_REFRESH_TOKEN');

      await update(created.id, { active: true }).expect(200);
      await login(e2e.server, created.email);
    });

    it('does not let an administrator deactivate their own account', async () => {
      const response = await update(admin.userId, { active: false }).expect(
        409,
      );
      expect((response.body as ErrorBody).code).toBe(
        'CANNOT_CHANGE_OWN_ACCESS',
      );

      const stored = await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: admin.userId },
      });
      expect(stored).toMatchObject({ role: 'ADMIN', active: true });
    });
  });

  describe('editing a staff account', () => {
    it('changes names and email, keeps the role, and the new email signs in', async () => {
      const tag = randomUUID().slice(0, 8);
      const created = await createStaff(
        staffBody(tag, { middleName: 'Sofía' }),
      );
      const newEmail = `hu05-${tag}-nuevo@trackhive.test`;

      const response = await update(created.id, {
        firstName: 'Lucía',
        middleName: '',
        secondLastName: 'Ríos',
        email: newEmail.toUpperCase(),
      }).expect(200);

      expect(response.body).toMatchObject({
        firstName: 'Lucía',
        middleName: null,
        lastName: 'Gómez',
        secondLastName: 'Ríos',
        email: newEmail,
        role: 'PERSONAL',
        active: true,
      });
      const stored = await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored).toMatchObject({
        firstName: 'Lucía',
        middleName: null,
        email: newEmail,
        role: 'PERSONAL',
      });
      await login(e2e.server, newEmail);
    });

    it('cannot change PERSONAL to ADMIN: role is not allowed in the body', async () => {
      const created = await createStaff(staffBody(randomUUID().slice(0, 8)));

      const response = await update(created.id, { role: 'ADMIN' }).expect(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'role', messages: ['El campo role no está permitido.'] },
        ],
      });

      const stored = await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored.role).toBe('PERSONAL');
    });

    it('rejects an email of another account with 409', async () => {
      const tag = randomUUID().slice(0, 8);
      const created = await createStaff(staffBody(tag));

      const response = await update(created.id, { email: admin.email }).expect(
        409,
      );
      expect((response.body as ErrorBody).code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('does not manage a public account: 404 and no change', async () => {
      const publicUser = await signUpPublicUser(e2e.server, 'hu05-publico');

      const response = await update(publicUser.userId, {
        active: false,
      }).expect(404);
      expect((response.body as ErrorBody).code).toBe('STAFF_USER_NOT_FOUND');

      const stored = await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: publicUser.userId },
      });
      expect(stored).toMatchObject({ role: 'PUBLICO', active: true });
    });

    it('rejects an id that is not a UUID with 400', async () => {
      await update('no-es-uuid', { active: false }).expect(400);
    });
  });

  describe('criterion 3: the listing has pagination, filters and order', () => {
    const tag = randomUUID().slice(0, 8);
    const list = async (query: Record<string, string | number | boolean>) =>
      (
        await request(e2e.server)
          .get(STAFF)
          .query({ q: tag, ...query })
          .set('Authorization', bearer(admin))
          .expect(200)
      ).body as StaffPageBody;
    const lastNames = (page: StaffPageBody) =>
      page.items.map((item) => item.lastName);

    beforeAll(async () => {
      await createStaff(
        staffBody(`${tag}-1`, { firstName: 'Laura', lastName: 'Castro' }),
      );
      // ADMIN accounts are not created through the API: inserted like the seed
      await e2e.prisma.userModel.create({
        data: {
          id: randomUUID(),
          firstName: 'Mario',
          lastName: 'Acosta',
          email: `hu05-${tag}-2@trackhive.test`,
          passwordHash: '$argon2id$not-used',
          role: 'ADMIN',
        },
      });
      const barrios = await createStaff(
        staffBody(`${tag}-3`, { firstName: 'Ana', lastName: 'Barrios' }),
      );
      await update(barrios.id, { active: false }).expect(200);
      // A public account with the tag never shows up in the staff listing
      await signUpPublicUser(e2e.server, `hu05-${tag}-publico`);
    });

    it('paginates the staff accounts, by last name by default', async () => {
      const first = await list({ limit: 2 });
      const second = await list({ limit: 2, page: 2 });

      expect(first).toMatchObject({ page: 1, limit: 2, total: 3 });
      expect(lastNames(first)).toEqual(['Acosta', 'Barrios']);
      expect(lastNames(second)).toEqual(['Castro']);
      expect(first.items[0]).not.toHaveProperty('passwordHash');
    });

    it('filters by role, status and words of the name or email', async () => {
      expect(lastNames(await list({ role: 'ADMIN' }))).toEqual(['Acosta']);
      expect(lastNames(await list({ active: false }))).toEqual(['Barrios']);
      expect(lastNames(await list({ active: true }))).toEqual([
        'Acosta',
        'Castro',
      ]);
      expect(lastNames(await list({ q: `laura castro ${tag}` }))).toEqual([
        'Castro',
      ]);
    });

    it('orders by the chosen field and direction', async () => {
      expect(lastNames(await list({ order: 'desc' }))).toEqual([
        'Castro',
        'Barrios',
        'Acosta',
      ]);
      expect(
        (await list({ sort: 'firstName' })).items.map((item) => item.firstName),
      ).toEqual(['Ana', 'Laura', 'Mario']);
      expect(lastNames(await list({ sort: 'role', order: 'asc' }))[0]).toBe(
        'Acosta',
      );
    });

    it.each([
      { sort: 'passwordHash' },
      { order: 'up' },
      { role: 'PUBLICO' },
      { active: 'si' },
      { limit: 101 },
      { page: 0 },
    ])('rejects the parameter %p with 400', async (query) => {
      await request(e2e.server)
        .get(STAFF)
        .query(query)
        .set('Authorization', bearer(admin))
        .expect(400);
    });
  });

  describe("criterion 4: @Roles('ADMIN') — PERSONAL and PUBLICO get 403", () => {
    const calls = (session: Session | null, id: string, tag: string) => {
      const auth = (test: request.Test) =>
        session ? test.set('Authorization', bearer(session)) : test;
      return [
        auth(request(e2e.server).get(STAFF)),
        auth(request(e2e.server).post(STAFF).send(staffBody(tag))),
        auth(
          request(e2e.server).patch(`${STAFF}/${id}`).send({ active: false }),
        ),
      ];
    };

    it.each(['PERSONAL', 'PUBLICO'] as const)(
      'rejects %s on the three endpoints and changes nothing',
      async (role) => {
        const caller =
          role === 'PERSONAL'
            ? await signInStaffUser(e2e, 'PERSONAL')
            : await signUpPublicUser(e2e.server, 'hu05-sin-permiso');
        const target = await createStaff(staffBody(randomUUID().slice(0, 8)));
        const tag = randomUUID().slice(0, 8);

        for (const call of calls(caller, target.id, tag)) {
          const response = await call.expect(403);
          expect(response.body as ErrorBody).toMatchObject({
            statusCode: 403,
            code: 'FORBIDDEN',
          });
        }

        // Nothing was created and the target is still active
        expect(
          await e2e.prisma.userModel.count({
            where: { email: `hu05-${tag}@trackhive.test` },
          }),
        ).toBe(0);
        const stored = await e2e.prisma.userModel.findUniqueOrThrow({
          where: { id: target.id },
        });
        expect(stored.active).toBe(true);
      },
    );

    it('rejects a request without a session with 401', async () => {
      for (const call of calls(null, randomUUID(), randomUUID().slice(0, 8))) {
        await call.expect(401);
      }
    });
  });
});
