import request from 'supertest';
import { MAX_REQUEST_PAGE_LIMIT } from '../../src/common/pagination';
import {
  API,
  E2eApp,
  Session,
  bearer,
  createE2eApp,
  createMaterial,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
  validDesiredDate,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
}

/**
 * «Radicar solicitud» (HU-09) against PostgreSQL (HU-41): a public user
 * files a request for archive material and it is stored with its items,
 * its requester and the first row of its history.
 */
describe('Request registration flow, HU-09 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let requester: Session;

  beforeAll(async () => {
    e2e = await createE2eApp();
    requester = await signUpPublicUser(e2e.server, 'radicar');
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('files a request with 201, RECIBIDA and a tracking code, and stores it whole', async () => {
    const { prisma } = e2e;
    const first = await createMaterial(prisma, 'Actas de 1890');
    const second = await createMaterial(prisma, 'El Heraldo, 1925');

    // Computed once: a second call could fall on the next day at midnight
    const desiredDate = validDesiredDate();

    const created = await submitRequest(
      e2e.server,
      requester,
      [first.id, second.id],
      'PRESENCIAL',
      desiredDate,
    );

    expect(created.status).toBe('RECIBIDA');
    expect(created.trackingCode).toMatch(/^SOL-\d{4}-\d{5}$/);

    const stored = await prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true, requester: true, statusHistory: true },
    });
    expect(stored).toMatchObject({
      trackingCode: created.trackingCode,
      status: 'RECIBIDA',
      createdById: requester.userId,
      deliveryMode: 'PRESENCIAL',
      originChannel: 'WEB',
      version: 1,
    });
    expect(stored.desiredDate.toISOString().slice(0, 10)).toBe(desiredDate);
    // The request is for the requester created at sign-up, not a new one
    expect(stored.requester).toMatchObject({
      userId: requester.userId,
      email: requester.email,
    });
    expect(stored.items.map((item) => item.materialId).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    // The history starts with the creation (D-08)
    expect(stored.statusHistory).toEqual([
      expect.objectContaining({
        previousStatus: null,
        newStatus: 'RECIBIDA',
        userId: requester.userId,
      }),
    ]);
  });

  it('lists it in «Mis solicitudes» of its owner (HU-11)', async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await submitRequest(e2e.server, requester, [material.id]);

    const response = await request(e2e.server)
      .get(`${API}/requests/mine`)
      .query({ limit: MAX_REQUEST_PAGE_LIMIT })
      .set('Authorization', bearer(requester))
      .expect(200);

    const { items } = response.body as {
      items: Array<{ id: string; trackingCode: string; status: string }>;
    };
    expect(items).toContainEqual(
      expect.objectContaining({
        id: created.id,
        trackingCode: created.trackingCode,
        status: 'RECIBIDA',
      }),
    );
  });

  it('shows the staff the requester and the location of the material (HU-13)', async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await submitRequest(e2e.server, requester, [material.id]);
    const staff = await signInStaffUser(e2e);

    const response = await request(e2e.server)
      .get(`${API}/requests/${created.id}`)
      .set('Authorization', bearer(staff))
      .expect(200);

    expect(response.body).toMatchObject({
      id: created.id,
      status: 'RECIBIDA',
      allowedTransitions: expect.arrayContaining([
        'EN_BUSQUEDA',
        'RECHAZADA',
      ]) as unknown,
      requester: { email: requester.email },
      materials: [
        {
          id: material.id,
          catalogCode: material.catalogCode,
          location: { depot: 'D1', shelf: 'E3', box: 'C12' },
        },
      ],
    });
  });

  it('gives every request its own tracking code from the sequence (RN-01)', async () => {
    const material = await createMaterial(e2e.prisma);
    const codes = await Promise.all(
      [1, 2, 3].map(() =>
        submitRequest(e2e.server, requester, [material.id]).then(
          (created) => created.trackingCode,
        ),
      ),
    );

    expect(new Set(codes).size).toBe(3);
  });

  it('rejects a material that does not exist with 404 and saves nothing', async () => {
    // Other e2e files file requests at the same time: count only this user's
    const ownRequests = () =>
      e2e.prisma.requestModel.count({
        where: { createdById: requester.userId },
      });
    const before = await ownRequests();

    const response = await request(e2e.server)
      .post(`${API}/requests`)
      .set('Authorization', bearer(requester))
      .send({
        materialIds: ['c3f6c8f0-1c2b-4e3d-8f4a-123456789abc'],
        reason: 'Consulta para un trabajo de investigación',
        desiredDate: validDesiredDate(),
        deliveryMode: 'PRESENCIAL',
      })
      .expect(404);

    expect((response.body as ErrorBody).code).toBe(
      'REQUEST_MATERIAL_NOT_FOUND',
    );
    expect(await ownRequests()).toBe(before);
  });

  it('rejects a desired date sooner than 10 business days with 400 INVALID_DESIRED_DATE', async () => {
    const material = await createMaterial(e2e.prisma);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const response = await request(e2e.server)
      .post(`${API}/requests`)
      .set('Authorization', bearer(requester))
      .send({
        materialIds: [material.id],
        reason: 'Consulta para un trabajo de investigación',
        desiredDate: tomorrow,
        deliveryMode: 'PRESENCIAL',
      })
      .expect(400);

    expect((response.body as ErrorBody).code).toBe('INVALID_DESIRED_DATE');
    expect(
      await e2e.prisma.requestItemModel.count({
        where: { materialId: material.id },
      }),
    ).toBe(0);
  });
});
