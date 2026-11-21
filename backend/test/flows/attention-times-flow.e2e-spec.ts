import { randomUUID } from 'crypto';
import request from 'supertest';
import {
  API,
  bearer,
  changeStatus,
  createE2eApp,
  createMaterial,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
} from '../support/e2e-app';
import type { E2eApp, Session } from '../support/e2e-app';
import type { AttentionTimesResponseDto } from '../../src/requests/application/dto/attention-times-response.dto';

jest.setTimeout(30000);

describe('Attention times report, HU-25 (PostgreSQL flow)', () => {
  let e2e: E2eApp;
  let admin: Session, staff: Session, publicUser: Session;
  const range = { from: '2001-03-01', to: '2001-03-31' };
  const ids: string[] = [];
  const report = (
    session: Session | null,
    query: Record<string, unknown> = range,
  ) => {
    const call = request(e2e.server)
      .get(`${API}/reports/attention-times`)
      .query(query);
    return session ? call.set('Authorization', bearer(session)) : call;
  };

  beforeAll(async () => {
    e2e = await createE2eApp();
    admin = await signInStaffUser(e2e, 'ADMIN');
    staff = await signInStaffUser(e2e, 'PERSONAL');
    publicUser = await signUpPublicUser(e2e.server, 'attention');
    const material = await createMaterial(e2e.prisma);
    const initial = await submitRequest(
      e2e.server,
      publicUser,
      [material.id],
      'DIGITAL',
    );
    const template = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: initial.id },
    });
    // Historical fixtures are INSERTs; the immutable audit trail is never edited.
    const fixture = async (
      received: string,
      events: [string, number][],
      storedEndHours: number | null,
      status = 'ATENDIDA',
    ) => {
      const { id: oldId, trackingCode: oldCode, ...fields } = template;
      void oldId;
      void oldCode;
      const id = randomUUID();
      const start = new Date(received);
      await e2e.prisma.$transaction(async (tx) => {
        await tx.requestModel.create({
          data: {
            ...fields,
            id,
            trackingCode: `AT-${id.slice(0, 12)}`,
            registeredAt: start,
            attendedAt:
              storedEndHours === null
                ? null
                : new Date(start.getTime() + storedEndHours * 3600000),
            status,
            rejectionReason:
              status === 'RECHAZADA' ? 'Material no consultable' : null,
            closedAt:
              status === 'CERRADA'
                ? new Date(start.getTime() + 12 * 3600000)
                : null,
            items: { create: { id: randomUUID(), materialId: material.id } },
          },
        });
        let previous: string | null = null;
        for (const [next, hour] of events) {
          await tx.statusHistoryModel.create({
            data: {
              requestId: id,
              userId: staff.userId,
              previousStatus: previous,
              newStatus: next,
              changedAt: new Date(start.getTime() + hour * 3600000),
            },
          });
          previous = next;
        }
      });
      ids.push(id);
    };
    await fixture(
      '2001-03-01T05:00:00Z',
      [
        ['RECIBIDA', 0],
        ['EN_BUSQUEDA', 2],
        ['DISPONIBLE', 5],
        ['ATENDIDA', 9],
      ],
      // Legacy denormalized timestamp is stale; the immutable history says 9h.
      0,
    );
    await fixture(
      '2001-03-15T12:00:00Z',
      [
        ['RECIBIDA', 0],
        ['DISPONIBLE', 1],
        ['ATENDIDA', 5],
      ],
      5,
    );
    await fixture(
      '2001-04-01T04:59:59Z',
      [
        ['RECIBIDA', 0],
        ['EN_BUSQUEDA', 1],
        ['DISPONIBLE', 2],
        ['AGENDADA', 3],
        ['DISPONIBLE', 5],
        ['AGENDADA', 6],
        ['ATENDIDA', 10],
        ['CERRADA', 12],
      ],
      10,
      'CERRADA',
    );
    await fixture(
      '2001-03-20T05:00:00Z',
      [
        ['RECIBIDA', 0],
        ['DISPONIBLE', 0],
        ['ATENDIDA', 0],
      ],
      0,
    );
    await fixture(
      '2001-03-01T04:59:59Z',
      [
        ['RECIBIDA', 0],
        ['ATENDIDA', 100],
      ],
      100,
    );
    await fixture(
      '2001-04-01T05:00:00Z',
      [
        ['RECIBIDA', 0],
        ['ATENDIDA', 100],
      ],
      100,
    );
    await fixture('2001-03-10T12:00:00Z', [['RECIBIDA', 0]], null, 'RECIBIDA');
    await fixture(
      '2001-03-10T12:00:00Z',
      [
        ['RECIBIDA', 0],
        ['RECHAZADA', 8],
      ],
      null,
      'RECHAZADA',
    );
    // Old records may predate the complete audit trail but keep attended_at.
    await fixture('2002-01-01T05:00:00Z', [['RECIBIDA', 0]], 6);
  });
  afterAll(async () => {
    await e2e?.app.close();
  });

  const snapshot = async () => ({
    requests: await e2e.prisma.requestModel.findMany({
      where: { id: { in: ids } },
      orderBy: { id: 'asc' },
    }),
    history: await e2e.prisma.statusHistoryModel.findMany({
      where: { requestId: { in: ids } },
      orderBy: { id: 'asc' },
    }),
    notifications: await e2e.prisma.notificationModel.count(),
  });

  it('computes elapsed and per-state means, excluding skipped states and summing repeat visits per request', async () => {
    const before = await snapshot();
    const response = await report(admin).expect(200);
    const data = response.body as AttentionTimesResponseDto;
    expect(data).toEqual({
      ...range,
      completedRequests: 4,
      averageSeconds: 6 * 3600,
      states: [
        { state: 'RECIBIDA', requestCount: 4, averageSeconds: 3600 },
        { state: 'EN_BUSQUEDA', requestCount: 2, averageSeconds: 2 * 3600 },
        { state: 'DISPONIBLE', requestCount: 4, averageSeconds: 2.5 * 3600 },
        { state: 'AGENDADA', requestCount: 1, averageSeconds: 6 * 3600 },
      ],
    });
    expect(await snapshot()).toEqual(before);
  });

  it('uses inclusive Bogota registration boundaries, without clipping completion at the end of the range', async () => {
    const result = await report(admin, {
      from: '2001-03-31',
      to: '2001-03-31',
    }).expect(200);
    expect(result.body).toMatchObject({
      completedRequests: 1,
      averageSeconds: 10 * 3600,
    });
    const direct = await report(admin, {
      from: '2001-03-15',
      to: '2001-03-15',
    }).expect(200);
    expect(
      (direct.body as AttentionTimesResponseDto).states.find(
        (row) => row.state === 'EN_BUSQUEDA',
      ),
    ).toEqual({ state: 'EN_BUSQUEDA', requestCount: 0, averageSeconds: null });
    const empty = await report(admin, {
      from: '1980-01-01',
      to: '1980-01-31',
    }).expect(200);
    expect(empty.body).toMatchObject({
      completedRequests: 0,
      averageSeconds: null,
    });
  });

  it('returns 401/403/400 without writing requests, histories or notifications', async () => {
    const before = await snapshot();
    await report(null).expect(401);
    await report(staff).expect(403);
    await report(publicUser).expect(403);
    await report(admin, { from: '2001-03-31', to: '2001-03-01' }).expect(400);
    await report(admin, { from: '2001-02-30' }).expect(400);
    expect(await snapshot()).toEqual(before);
  });

  it('includes legacy attended requests without inventing missing intermediate states', async () => {
    const response = await report(admin, {
      from: '2002-01-01',
      to: '2002-01-01',
    }).expect(200);
    const result = response.body as AttentionTimesResponseDto;
    expect(result.completedRequests).toBe(1);
    expect(result.averageSeconds).toBe(6 * 3600);
    expect(result.states.find((row) => row.state === 'EN_BUSQUEDA')).toEqual({
      state: 'EN_BUSQUEDA',
      requestCount: 0,
      averageSeconds: null,
    });
  });

  it('includes a request attended and closed through the actual API and persists its audit trail', async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await submitRequest(
      e2e.server,
      publicUser,
      [material.id],
      'DIGITAL',
    );
    for (const status of ['EN_BUSQUEDA', 'DISPONIBLE', 'ATENDIDA', 'CERRADA']) {
      await changeStatus(e2e.server, staff, created.id, { status }).expect(200);
    }
    const saved = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(saved.status).toBe('CERRADA');
    expect(saved.attendedAt).not.toBeNull();
    const history = await e2e.prisma.statusHistoryModel.findMany({
      where: { requestId: created.id },
      orderBy: { id: 'asc' },
    });
    expect(history.map((row) => row.newStatus)).toEqual([
      'RECIBIDA',
      'EN_BUSQUEDA',
      'DISPONIBLE',
      'ATENDIDA',
      'CERRADA',
    ]);
    const result = await report(admin, {}).expect(200);
    expect(
      (result.body as AttentionTimesResponseDto).completedRequests,
    ).toBeGreaterThanOrEqual(7);
  });
});
