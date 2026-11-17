import request from 'supertest';
import { MAX_REQUEST_PAGE_LIMIT } from '../../src/common/pagination';
import {
  API,
  E2eApp,
  Session,
  bearer,
  changeStatus,
  createE2eApp,
  createMaterial,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
}

/**
 * «Cambiar estado de una solicitud» (HU-15) against PostgreSQL (HU-41): the
 * status, the history row (D-08) and the email of the outbox (HU-23, D-10)
 * are saved together, and a refused change saves none of them.
 */
describe('Status change flow, HU-15 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let requester: Session;
  let staff: Session;

  const newRequest = async () => {
    const material = await createMaterial(e2e.prisma);
    return submitRequest(e2e.server, requester, [material.id]);
  };

  const historyOf = (requestId: string) =>
    e2e.prisma.statusHistoryModel.findMany({
      where: { requestId },
      orderBy: { id: 'asc' },
    });

  const outboxOf = (requestId: string) =>
    e2e.prisma.notificationModel.findMany({ where: { requestId } });

  beforeAll(async () => {
    e2e = await createE2eApp();
    requester = await signUpPublicUser(e2e.server, 'estado');
    staff = await signInStaffUser(e2e);
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('moves RECIBIDA to EN_BUSQUEDA and saves the status, the history and the email together', async () => {
    const created = await newRequest();

    const response = await changeStatus(e2e.server, staff, created.id, {
      status: 'EN_BUSQUEDA',
      comment: 'Se busca en el depósito 1',
    }).expect(200);

    expect(response.body).toMatchObject({
      id: created.id,
      status: 'EN_BUSQUEDA',
      allowedTransitions: expect.arrayContaining(['DISPONIBLE']) as unknown,
      statusChange: {
        previousStatus: 'RECIBIDA',
        newStatus: 'EN_BUSQUEDA',
        changedBy: { id: staff.userId },
        comment: 'Se busca en el depósito 1',
      },
    });

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    // Optimistic locking: every change raises the version
    expect(stored).toMatchObject({ status: 'EN_BUSQUEDA', version: 2 });

    const history = await historyOf(created.id);
    expect(history).toEqual([
      expect.objectContaining({ previousStatus: null, newStatus: 'RECIBIDA' }),
      expect.objectContaining({
        previousStatus: 'RECIBIDA',
        newStatus: 'EN_BUSQUEDA',
        userId: staff.userId,
        comment: 'Se busca en el depósito 1',
      }),
    ]);

    // The email waits in the outbox, tied to the history row (HU-23)
    expect(await outboxOf(created.id)).toEqual([
      expect.objectContaining({
        recipientEmail: requester.email,
        template: 'CAMBIO_ESTADO',
        deliveryStatus: 'PENDIENTE',
        statusHistoryId: history[1].id,
      }),
    ]);
  });

  it('shows the owner the whole history, with «Personal del CLENA» as the staff (HU-17)', async () => {
    const created = await newRequest();
    await changeStatus(e2e.server, staff, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(200);
    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
    }).expect(200);

    const response = await request(e2e.server)
      .get(`${API}/requests/${created.id}/history`)
      .set('Authorization', bearer(requester))
      .expect(200);

    const { entries } = response.body as {
      entries: Array<{ newStatus: string; changedBy: string }>;
    };
    expect(entries.map((entry) => entry.newStatus)).toEqual([
      'RECIBIDA',
      'EN_BUSQUEDA',
      'DISPONIBLE',
    ]);
    expect(entries[2].changedBy).toBe('Personal del CLENA');
  });

  it('rejects an invalid transition with 409 and saves nothing', async () => {
    const created = await newRequest();

    const response = await changeStatus(e2e.server, staff, created.id, {
      status: 'ATENDIDA',
    }).expect(409);

    expect((response.body as ErrorBody).code).toBe('INVALID_STATUS_TRANSITION');
    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored).toMatchObject({ status: 'RECIBIDA', version: 1 });
    expect(await historyOf(created.id)).toHaveLength(1);
    expect(await outboxOf(created.id)).toHaveLength(0);
  });

  it('rejects a public user with 403 and changes nothing', async () => {
    const created = await newRequest();

    const response = await changeStatus(e2e.server, requester, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(403);

    // The roles guard answers before the use case runs
    expect((response.body as ErrorBody).code).toBe('FORBIDDEN');
    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored).toMatchObject({ status: 'RECIBIDA', version: 1 });
    expect(await historyOf(created.id)).toHaveLength(1);
    expect(await outboxOf(created.id)).toHaveLength(0);
  });

  it('rejects with a reason that the requester reads in «Mis solicitudes» (HU-16)', async () => {
    const created = await newRequest();
    const reason = 'El material está en restauración hasta marzo';

    await changeStatus(e2e.server, staff, created.id, {
      status: 'RECHAZADA',
      comment: reason,
    }).expect(200);

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored).toMatchObject({
      status: 'RECHAZADA',
      rejectionReason: reason,
    });

    const mine = await request(e2e.server)
      .get(`${API}/requests/mine`)
      .query({ limit: MAX_REQUEST_PAGE_LIMIT })
      .set('Authorization', bearer(requester))
      .expect(200);
    const { items } = mine.body as {
      items: Array<{ id: string; rejectionReason: string | null }>;
    };
    expect(items.find((item) => item.id === created.id)).toMatchObject({
      rejectionReason: reason,
    });

    // A closed request does not change again
    const closed = await changeStatus(e2e.server, staff, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(409);
    expect((closed.body as ErrorBody).code).toBe('INVALID_STATUS_TRANSITION');
    expect(await historyOf(created.id)).toHaveLength(2);
  });

  it('rejects RECHAZADA without a reason with 400 REJECTION_REASON_REQUIRED', async () => {
    const created = await newRequest();

    const response = await changeStatus(e2e.server, staff, created.id, {
      status: 'RECHAZADA',
      comment: '   ',
    }).expect(400);

    expect((response.body as ErrorBody).code).toBe('REJECTION_REASON_REQUIRED');
    expect(await historyOf(created.id)).toHaveLength(1);
  });

  it('answers 404 for a request that does not exist', async () => {
    const response = await changeStatus(
      e2e.server,
      staff,
      'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc',
      { status: 'EN_BUSQUEDA' },
    ).expect(404);

    expect((response.body as ErrorBody).code).toBe('REQUEST_NOT_FOUND');
  });
});
