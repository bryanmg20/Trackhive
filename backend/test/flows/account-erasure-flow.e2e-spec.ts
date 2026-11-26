import request from 'supertest';
import { SendPendingNotificationsUseCase } from '../../src/notifications/application/use-cases/send-pending-notifications.use-case';
import { randomUUID } from 'crypto';
import { escapeHtml } from '../../src/common/html/escape-html';
import {
  API,
  bearer,
  changeStatus,
  createE2eApp,
  createMaterial,
  PASSWORD,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
} from '../support/e2e-app';
import type { E2eApp, Session } from '../support/e2e-app';
jest.setTimeout(30000);
describe('HU-33 account erasure (PostgreSQL)', () => {
  let e2e: E2eApp, admin: Session;
  beforeAll(async () => {
    e2e = await createE2eApp();
    admin = await signInStaffUser(e2e, 'ADMIN');
  });
  afterAll(async () => e2e.app.close());
  const remove = (user: Session, body: unknown = { confirmation: true }) =>
    request(e2e.server)
      .delete(`${API}/users/me/profile`)
      .set('Authorization', bearer(user))
      .send(body);
  it('requires a session and explicit confirmation and rejects another user id without writes', async () => {
    await request(e2e.server)
      .delete(`${API}/users/me/profile`)
      .send({ confirmation: true })
      .expect(401);
    const user = await signUpPublicUser(e2e.server, 'erase-validation');
    const before = await e2e.prisma.userModel.findUniqueOrThrow({
      where: { id: user.userId },
    });
    for (const body of [
      {},
      { confirmation: false },
      { confirmation: 'true' },
      { confirmation: true, userId: admin.userId },
    ])
      await remove(user, body).expect(400);
    expect(
      await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: user.userId },
      }),
    ).toEqual(before);
  });
  it('erases identity, characterization, free text and notifications but preserves anonymous report totals', async () => {
    const owner = await signUpPublicUser(e2e.server, 'erase-complete');
    const other = await signUpPublicUser(e2e.server, 'erase-other');
    const otherBefore = await e2e.prisma.userModel.findUniqueOrThrow({
      where: { id: other.userId },
    });
    const requester = await e2e.prisma.requesterModel.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    await e2e.prisma.requesterModel.update({
      where: { id: requester.id },
      data: {
        phone: '3001234567',
        documentType: 'CC',
        documentNumber: randomUUID().slice(0, 12),
        institution: 'Institución privada',
        populationGroup: 'MIGRANTE',
      },
    });
    const material = await createMaterial(e2e.prisma);
    const filed = await submitRequest(
      e2e.server,
      owner,
      [material.id],
      'DIGITAL',
    );
    await changeStatus(e2e.server, admin, filed.id, {
      status: 'EN_BUSQUEDA',
      comment: owner.email,
    }).expect(200);
    await changeStatus(e2e.server, admin, filed.id, {
      status: 'DISPONIBLE',
    }).expect(200);
    await changeStatus(e2e.server, admin, filed.id, {
      status: 'ATENDIDA',
    }).expect(200);
    await e2e.prisma.requestModel.update({
      where: { id: filed.id },
      data: {
        reason: owner.email,
        requirementDescription: owner.email,
        notes: owner.email,
      },
    });
    await e2e.prisma.requestItemModel.updateMany({
      where: { requestId: filed.id },
      data: { note: owner.email },
    });
    await e2e.prisma.requestReferenceModel.create({
      data: {
        id: randomUUID(),
        requestId: filed.id,
        kind: 'TEXTO_LIBRE',
        description: owner.email,
      },
    });
    const historyBefore = await e2e.prisma.statusHistoryModel.findMany({
      where: { requestId: filed.id },
      orderBy: { id: 'asc' },
    });
    const rankingBefore = await request(e2e.server)
      .get(`${API}/reports/most-requested-materials`)
      .set('Authorization', bearer(admin))
      .expect(200);
    const timesBefore = await request(e2e.server)
      .get(`${API}/reports/attention-times`)
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(
      await e2e.prisma.notificationModel.count({
        where: { requestId: filed.id },
      }),
    ).toBeGreaterThan(0);
    await remove(owner).expect(204);
    const erasedUser = await e2e.prisma.userModel.findUniqueOrThrow({
      where: { id: owner.userId },
    });
    expect(erasedUser).toMatchObject({
      firstName: 'Persona',
      lastName: 'anonimizada',
      middleName: null,
      secondLastName: null,
      active: false,
      privacyPolicyAcceptedAt: null,
      privacyPolicyVersion: null,
      lastLoginAt: null,
    });
    expect(erasedUser.deletedAt).not.toBeNull();
    expect(erasedUser.email).not.toBe(owner.email);
    expect(erasedUser.passwordHash).toBe('ACCOUNT_DELETED');
    const erased = await e2e.prisma.requesterModel.findUniqueOrThrow({
      where: { id: requester.id },
    });
    expect(erased).toMatchObject({
      firstName: 'Persona',
      lastName: 'anonimizada',
      middleName: null,
      secondLastName: null,
      email: null,
      phone: null,
      documentType: null,
      documentNumber: null,
      institution: null,
      municipality: null,
      ageRange: null,
      populationGroup: null,
      acceptsDataProcessing: false,
    });
    expect(erased.anonymizedAt).not.toBeNull();
    expect(
      await e2e.prisma.refreshTokenModel.count({
        where: { userId: owner.userId },
      }),
    ).toBe(0);
    expect(
      await e2e.prisma.notificationModel.count({
        where: { requestId: filed.id },
      }),
    ).toBe(0);
    const historyAfter = await e2e.prisma.statusHistoryModel.findMany({
      where: { requestId: filed.id },
      orderBy: { id: 'asc' },
    });
    expect(historyAfter).toEqual(
      historyBefore.map((event) => ({ ...event, comment: null })),
    );
    const detail = await request(e2e.server)
      .get(`${API}/requests/${filed.id}`)
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(JSON.stringify(detail.body)).not.toContain(owner.email);
    expect(JSON.stringify(detail.body)).not.toContain('Pérez');
    const rankingAfter = await request(e2e.server)
      .get(`${API}/reports/most-requested-materials`)
      .set('Authorization', bearer(admin))
      .expect(200);
    const timesAfter = await request(e2e.server)
      .get(`${API}/reports/attention-times`)
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(rankingAfter.body).toEqual(rankingBefore.body);
    expect(timesAfter.body).toEqual(timesBefore.body);
    await request(e2e.server)
      .post(`${API}/auth/login`)
      .send({ email: owner.email, password: PASSWORD })
      .expect(401);
    await request(e2e.server)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: owner.refreshToken })
      .expect(401);
    await request(e2e.server)
      .get(`${API}/users/me/profile`)
      .set('Authorization', bearer(owner))
      .expect(401);
    await remove(owner).expect(401);
    expect(
      await e2e.prisma.userModel.findUniqueOrThrow({
        where: { id: other.userId },
      }),
    ).toEqual(otherBefore);
    await expect(
      e2e.prisma.userModel.update({
        where: { id: owner.userId },
        data: { active: true },
      }),
    ).rejects.toThrow();
    await expect(
      e2e.prisma.requesterModel.update({
        where: { id: requester.id },
        data: { municipality: 'Restored' },
      }),
    ).rejects.toThrow();
    await expect(
      e2e.prisma.statusHistoryModel.update({
        where: { id: historyAfter[0].id },
        data: { comment: 'Restored' },
      }),
    ).rejects.toThrow();
  });
  it.each(['PERSONAL', 'ADMIN'] as const)(
    'allows authenticated %s to erase their own account without a roles restriction',
    async (role) => {
      const user = await signInStaffUser(e2e, role);
      const visitor = await signUpPublicUser(e2e.server, 'erase-staff-comment');
      const material = await createMaterial(e2e.prisma);
      const filed = await submitRequest(e2e.server, visitor, [material.id]);
      await changeStatus(e2e.server, user, filed.id, {
        status: 'EN_BUSQUEDA',
        comment: `Correo: ${user.email}\n<dato & privado>`,
      }).expect(200);
      const queued = await e2e.prisma.notificationModel.findFirstOrThrow({
        where: { statusHistory: { userId: user.userId }, requestId: filed.id },
      });
      const before = await e2e.prisma.notificationModel.update({
        where: { id: queued.id },
        data: { scheduledAt: new Date(0) },
      });
      expect(before.deliveryStatus).toBe('PENDIENTE');
      await remove(user).expect(204);
      const after = await e2e.prisma.notificationModel.findUniqueOrThrow({
        where: { id: queued.id },
      });
      expect({
        ...after,
        body: before.body,
        htmlBody: before.htmlBody,
      }).toEqual(before);
      expect(after.body).not.toContain(user.email);
      expect(after.htmlBody).not.toContain(user.email);
      expect(after.body).toContain('Ana Pérez');
      await e2e.app.get(SendPendingNotificationsUseCase).execute();
      expect(
        (
          await e2e.prisma.notificationModel.findUniqueOrThrow({
            where: { id: queued.id },
          })
        ).deliveryStatus,
      ).toBe('ENVIADA');
      expect(
        e2e.mail.sent.find(
          (mail) => mail.to === visitor.email && mail.subject === after.subject,
        ),
      ).toMatchObject({ text: after.body, html: after.htmlBody });
      expect(
        await e2e.prisma.statusHistoryModel.findMany({
          where: { userId: user.userId },
          select: { comment: true },
        }),
      ).toEqual([{ comment: null }]);
      expect(
        (
          await e2e.prisma.userModel.findUniqueOrThrow({
            where: { id: visitor.userId },
          })
        ).email,
      ).toBe(visitor.email);
      await request(e2e.server)
        .get(`${API}/users/me/profile`)
        .set('Authorization', bearer(user))
        .expect(401);
    },
  );
  it('cleans several third-party notifications in bulk, including changed templates and NULL HTML, and delivers them', async () => {
    const staff = await signInStaffUser(e2e, 'PERSONAL');
    const visitor = await signUpPublicUser(e2e.server, 'erase-batch');
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const material = await createMaterial(e2e.prisma);
      const filed = await submitRequest(e2e.server, visitor, [material.id]);
      const comment = `Privado ${staff.email} #${index} <&>\nlínea 'citada'`;
      await changeStatus(e2e.server, staff, filed.id, {
        status: 'EN_BUSQUEDA',
        comment,
      }).expect(200);
      const queued = await e2e.prisma.notificationModel.findFirstOrThrow({
        where: { requestId: filed.id, statusHistory: { userId: staff.userId } },
      });
      await e2e.prisma.notificationModel.update({
        where: { id: queued.id },
        data: {
          scheduledAt: new Date(0),
          ...(index > 0
            ? {
                body: `Formato cambiado: ${comment} | repetido: ${comment}`,
                htmlBody:
                  index === 2
                    ? null
                    : `<section>${escapeHtml(comment).replace(/\r?\n/g, '<br>')}</section>`,
              }
            : {}),
        },
      });
      ids.push(queued.id);
    }
    const before = await e2e.prisma.notificationModel.findMany({
      where: { id: { in: ids } },
      orderBy: { id: 'asc' },
    });
    await remove(staff).expect(204);
    const after = await e2e.prisma.notificationModel.findMany({
      where: { id: { in: ids } },
      orderBy: { id: 'asc' },
    });
    expect(after).toHaveLength(3);
    for (const [index, row] of after.entries()) {
      expect({
        ...row,
        body: before[index].body,
        htmlBody: before[index].htmlBody,
      }).toEqual(before[index]);
      expect(row.body).not.toContain(staff.email);
      expect(row.htmlBody ?? '').not.toContain(staff.email);
      expect(row.body).toContain('[Comentario del personal suprimido]');
    }
    await e2e.app.get(SendPendingNotificationsUseCase).execute();
    for (const row of after) {
      expect(
        (
          await e2e.prisma.notificationModel.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).deliveryStatus,
      ).toBe('ENVIADA');
      expect(
        e2e.mail.sent.find(
          (mail) => mail.to === visitor.email && mail.subject === row.subject,
        ),
      ).toMatchObject({
        text: row.body,
        ...(row.htmlBody === null ? {} : { html: row.htmlBody }),
      });
    }
  });

  it('rejects deletion of the last active ADMIN without changing data or sessions', async () => {
    const user = await signInStaffUser(e2e, 'ADMIN');
    const others = await e2e.prisma.userModel.findMany({
      where: {
        role: 'ADMIN',
        active: true,
        deletedAt: null,
        id: { not: user.userId },
      },
      select: { id: true },
    });
    const ids = others.map((other) => other.id);
    const before = await e2e.prisma.userModel.findUniqueOrThrow({
      where: { id: user.userId },
    });
    const tokensBefore = await e2e.prisma.refreshTokenModel.count({
      where: { userId: user.userId },
    });
    await e2e.prisma.userModel.updateMany({
      where: { id: { in: ids } },
      data: { active: false },
    });
    try {
      const response = await remove(user).expect(409);
      expect(response.body).toMatchObject({
        code: 'LAST_ADMIN_CANNOT_BE_DELETED',
      });
      expect(
        await e2e.prisma.userModel.findUniqueOrThrow({
          where: { id: user.userId },
        }),
      ).toEqual(before);
      expect(
        await e2e.prisma.refreshTokenModel.count({
          where: { userId: user.userId },
        }),
      ).toBe(tokensBefore);
      await request(e2e.server)
        .get(`${API}/users/me/profile`)
        .set('Authorization', bearer(user))
        .expect(200);
    } finally {
      await e2e.prisma.userModel.updateMany({
        where: { id: { in: ids } },
        data: { active: true },
      });
    }
  });
  it('keeps an active ADMIN when two administrators erase themselves concurrently', async () => {
    const first = await signInStaffUser(e2e, 'ADMIN');
    const second = await signInStaffUser(e2e, 'ADMIN');
    const others = await e2e.prisma.userModel.findMany({
      where: {
        role: 'ADMIN',
        active: true,
        deletedAt: null,
        id: { notIn: [first.userId, second.userId] },
      },
      select: { id: true },
    });
    const ids = others.map((other) => other.id);
    await e2e.prisma.userModel.updateMany({
      where: { id: { in: ids } },
      data: { active: false },
    });
    try {
      const responses = await Promise.all([remove(first), remove(second)]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        204, 409,
      ]);
      expect(
        await e2e.prisma.userModel.count({
          where: { role: 'ADMIN', active: true, deletedAt: null },
        }),
      ).toBe(1);
      const conflict = responses.find((response) => response.status === 409);
      expect([
        'ACCOUNT_ERASURE_CONFLICT',
        'LAST_ADMIN_CANNOT_BE_DELETED',
      ]).toContain((conflict?.body as { code: string }).code);
    } finally {
      await e2e.prisma.userModel.updateMany({
        where: { id: { in: ids } },
        data: { active: true },
      });
    }
  });

  it('rolls back every erasure step if the final write fails', async () => {
    const user = await signUpPublicUser(e2e.server, 'erase-rollback');
    const requesterBefore = await e2e.prisma.requesterModel.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    const tokensBefore = await e2e.prisma.refreshTokenModel.count({
      where: { userId: user.userId },
    });
    // Force the final users UPDATE to fail; the preceding requester/token writes must roll back.
    await e2e.prisma.$executeRawUnsafe(
      `CREATE FUNCTION hu33_test_failure() RETURNS trigger AS $$ BEGIN IF NEW.id = '${user.userId}'::uuid THEN RAISE EXCEPTION 'forced erasure failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
    );
    await e2e.prisma.$executeRawUnsafe(
      'CREATE TRIGGER hu33_test_failure BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION hu33_test_failure()',
    );
    try {
      await remove(user).expect(500);
    } finally {
      await e2e.prisma.$executeRawUnsafe(
        'DROP TRIGGER hu33_test_failure ON users',
      );
      await e2e.prisma.$executeRawUnsafe('DROP FUNCTION hu33_test_failure()');
    }
    expect(
      await e2e.prisma.requesterModel.findUniqueOrThrow({
        where: { userId: user.userId },
      }),
    ).toEqual(requesterBefore);
    expect(
      await e2e.prisma.refreshTokenModel.count({
        where: { userId: user.userId },
      }),
    ).toBe(tokensBefore);
    expect(
      (
        await e2e.prisma.userModel.findUniqueOrThrow({
          where: { id: user.userId },
        })
      ).deletedAt,
    ).toBeNull();
  });
});
