import { randomUUID } from 'crypto';
import request from 'supertest';
import {
  API,
  E2eApp,
  Session,
  bearer,
  changeStatus,
  createE2eApp,
  signInStaffUser,
  signUpPublicUser,
  validDesiredDate,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
}

interface DetailBody {
  status: string;
  allowedTransitions: string[];
  commentRequiredFor: string[];
  materials: Record<string, unknown>[];
  references: { id: string }[];
}

type MaterialStatus = 'DISPONIBLE' | 'EN_RESTAURACION' | 'NO_CONSULTABLE';

// Root of the simulated tree of Everything (HU-133)
const PERIODICALS =
  'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Periódicos\\El Correo del Litoral';

/**
 * «Disponible directo cuando hay copia digital» (HU-139) against PostgreSQL:
 * a RECIBIDA request with a digital delivery whose materials all have the
 * copy the sync found, none NO_CONSULTABLE and no reference pending, goes
 * straight to DISPONIBLE; the history and the email are saved as in any
 * change (HU-23). Otherwise it goes through EN_BUSQUEDA, as before.
 */
describe('Direct availability with a digital copy, HU-139 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let requester: Session;
  let staff: Session;

  /** A material as the sync saves it: with its copy unless `withCopy` is false. */
  const createMaterial = async (
    status: MaterialStatus = 'DISPONIBLE',
    withCopy = true,
  ) => {
    const id = randomUUID();
    const catalogCode = `E2E-139-${id.slice(0, 8).toUpperCase()}`;
    await e2e.prisma.materialModel.create({
      data: {
        id,
        catalogCode,
        title: `1925 - ${catalogCode}`,
        materialType: 'PERIODICO',
        collection: 'Periódicos',
        status,
        source: 'EVERYTHING',
        digitalPath: withCopy ? `${PERIODICALS}\\1925\\${catalogCode}` : null,
        lastSeenAt: withCopy ? new Date() : null,
      },
    });
    return { id, catalogCode };
  };

  const fileRequest = async (body: {
    materialIds: string[];
    deliveryMode?: 'PRESENCIAL' | 'DIGITAL';
    references?: Record<string, unknown>[];
  }) => {
    const response = await request(e2e.server)
      .post(`${API}/requests`)
      .set('Authorization', bearer(requester))
      .send({
        reason: 'Consulta para un trabajo de investigación',
        desiredDate: validDesiredDate(),
        deliveryMode: 'DIGITAL',
        ...body,
      })
      .expect(201);
    return response.body as { id: string; trackingCode: string };
  };

  const detailOf = async (requestId: string) =>
    (
      await request(e2e.server)
        .get(`${API}/requests/${requestId}`)
        .set('Authorization', bearer(staff))
        .expect(200)
    ).body as DetailBody;

  const historyOf = (requestId: string) =>
    e2e.prisma.statusHistoryModel.findMany({
      where: { requestId },
      orderBy: { id: 'asc' },
    });

  const outboxOf = (requestId: string) =>
    e2e.prisma.notificationModel.findMany({ where: { requestId } });

  const storedRequest = (requestId: string) =>
    e2e.prisma.requestModel.findUniqueOrThrow({ where: { id: requestId } });

  /** A digital request whose two materials have their copy, one being restored. */
  const directRequest = async () => {
    const available = await createMaterial('DISPONIBLE');
    const restoring = await createMaterial('EN_RESTAURACION');
    return fileRequest({ materialIds: [available.id, restoring.id] });
  };

  beforeAll(async () => {
    e2e = await createE2eApp();
    requester = await signUpPublicUser(e2e.server, 'copia');
    staff = await signInStaffUser(e2e);
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('offers Disponible and Rechazada, not En búsqueda, when every material has a consultable copy', async () => {
    const created = await directRequest();

    const detail = await detailOf(created.id);

    expect(detail).toMatchObject({
      status: 'RECIBIDA',
      allowedTransitions: ['DISPONIBLE', 'RECHAZADA'],
      commentRequiredFor: ['RECHAZADA'],
    });
    expect(detail.materials.map((material) => material.hasDigitalCopy)).toEqual(
      [true, true],
    );
    // The path of the copy is internal (HU-134)
    detail.materials.forEach((material) =>
      expect(material).not.toHaveProperty('digitalPath'),
    );
  });

  it('moves RECIBIDA to DISPONIBLE and saves the status, the history with who did it and the email together', async () => {
    const created = await directRequest();

    const response = await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
      comment: 'La copia digital se envía por correo',
    }).expect(200);

    expect(response.body).toMatchObject({
      id: created.id,
      status: 'DISPONIBLE',
      allowedTransitions: ['ATENDIDA', 'CERRADA'],
      statusChange: {
        previousStatus: 'RECIBIDA',
        newStatus: 'DISPONIBLE',
        changedBy: { id: staff.userId },
        comment: 'La copia digital se envía por correo',
      },
    });
    expect(await storedRequest(created.id)).toMatchObject({
      status: 'DISPONIBLE',
      version: 2,
    });

    // RN-09: who did it, when and the comment, in the insert-only history
    const history = await historyOf(created.id);
    expect(history).toEqual([
      expect.objectContaining({ previousStatus: null, newStatus: 'RECIBIDA' }),
      expect.objectContaining({
        previousStatus: 'RECIBIDA',
        newStatus: 'DISPONIBLE',
        userId: staff.userId,
        comment: 'La copia digital se envía por correo',
      }),
    ]);

    // HU-23: the email waits in the outbox, tied to the history row
    const outbox = await outboxOf(created.id);
    expect(outbox).toEqual([
      expect.objectContaining({
        recipientEmail: requester.email,
        template: 'SOLICITUD_DISPONIBLE',
        deliveryStatus: 'PENDIENTE',
        statusHistoryId: history[1].id,
      }),
    ]);
    expect(outbox[0].body).toContain('le enviará la copia por correo');

    // The requester sees the step in the timeline (HU-17)
    const timeline = await request(e2e.server)
      .get(`${API}/requests/${created.id}/history`)
      .set('Authorization', bearer(requester))
      .expect(200);
    const { entries } = timeline.body as {
      entries: { newStatus: string }[];
    };
    expect(entries.map((entry) => entry.newStatus)).toEqual([
      'RECIBIDA',
      'DISPONIBLE',
    ]);
  });

  it('refuses En búsqueda with 409 when the copy was already found, and saves nothing', async () => {
    const created = await directRequest();

    const response = await changeStatus(e2e.server, staff, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(409);

    expect((response.body as ErrorBody).code).toBe('INVALID_STATUS_TRANSITION');
    expect(await storedRequest(created.id)).toMatchObject({
      status: 'RECIBIDA',
      version: 1,
    });
    expect(await historyOf(created.id)).toHaveLength(1);
    expect(await outboxOf(created.id)).toHaveLength(0);
  });

  const FREE_TEXT = {
    kind: 'TEXTO_LIBRE',
    description: 'El Heraldo, 15-03-1950',
  };

  it.each<[string, () => Promise<{ id: string }>]>([
    [
      'a material with its copy is not consultable',
      async () =>
        fileRequest({
          materialIds: [
            (await createMaterial('DISPONIBLE')).id,
            (await createMaterial('NO_CONSULTABLE')).id,
          ],
        }),
    ],
    [
      'a material has no digital copy',
      async () =>
        fileRequest({
          materialIds: [
            (await createMaterial('DISPONIBLE')).id,
            (await createMaterial('DISPONIBLE', false)).id,
          ],
        }),
    ],
    [
      'a reference is pending its material (HU-09.2)',
      async () =>
        fileRequest({
          materialIds: [(await createMaterial('DISPONIBLE')).id],
          references: [FREE_TEXT],
        }),
    ],
    [
      'the delivery is presential',
      async () =>
        fileRequest({
          materialIds: [(await createMaterial('DISPONIBLE')).id],
          deliveryMode: 'PRESENCIAL',
        }),
    ],
  ])(
    'keeps En búsqueda and Rechazada when %s: Disponible gets 409',
    async (_case, create) => {
      const created = await create();

      expect((await detailOf(created.id)).allowedTransitions).toEqual([
        'EN_BUSQUEDA',
        'RECHAZADA',
      ]);

      const refused = await changeStatus(e2e.server, staff, created.id, {
        status: 'DISPONIBLE',
      }).expect(409);
      expect((refused.body as ErrorBody).code).toBe(
        'INVALID_STATUS_TRANSITION',
      );
      expect(await historyOf(created.id)).toHaveLength(1);
      expect(await outboxOf(created.id)).toHaveLength(0);

      await changeStatus(e2e.server, staff, created.id, {
        status: 'EN_BUSQUEDA',
      }).expect(200);
    },
  );

  it('offers the direct step once the staff associates the material of the last reference', async () => {
    const created = await fileRequest({
      materialIds: [],
      references: [FREE_TEXT],
    });
    const before = await detailOf(created.id);
    expect(before.allowedTransitions).toEqual(['EN_BUSQUEDA', 'RECHAZADA']);

    // The sync brought its folder: the staff associates it while RECIBIDA
    const material = await createMaterial('DISPONIBLE');
    await request(e2e.server)
      .patch(
        `${API}/requests/${created.id}/references/${before.references[0].id}`,
      )
      .set('Authorization', bearer(staff))
      .send({ materialId: material.id })
      .expect(200);

    expect((await detailOf(created.id)).allowedTransitions).toEqual([
      'DISPONIBLE',
      'RECHAZADA',
    ]);
    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
    }).expect(200);
  });
});
