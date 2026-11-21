import request from 'supertest';
import {
  API,
  E2eApp,
  Session,
  bearer,
  changeStatus,
  createE2eApp,
  createMaterial,
  serviceDay,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
  validDesiredDate,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
}

interface CreatedBody {
  id: string;
  trackingCode: string;
  status: string;
}

/**
 * «Solicitar material que no está en el catálogo» (HU-09.2) against
 * PostgreSQL: a request may carry only written references (RN-04). A
 * reference without material blocks nothing: DISPONIBLE only needs a comment
 * and the appointment is made with the materials there are, even none.
 * Associating its catalog material saves the reference, the item and the
 * history row together. An error saves nothing.
 */
describe('Written references flow, HU-09.2 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let requester: Session;
  let staff: Session;

  const NOTARIAL = {
    kind: 'PROTOCOLO_NOTARIAL',
    notary: 'Notaría Primera de Barranquilla',
    year: 1950,
    deedNumber: '245',
  };

  const FREE_TEXT = {
    kind: 'TEXTO_LIBRE',
    description: 'El Heraldo, 15-03-1950',
  };

  const fileRequest = (body: Record<string, unknown>) =>
    request(e2e.server)
      .post(`${API}/requests`)
      .set('Authorization', bearer(requester))
      .send({
        reason: 'Consulta para un trabajo de investigación',
        desiredDate: validDesiredDate(),
        deliveryMode: 'PRESENCIAL',
        ...body,
      });

  const resolve = (
    requestId: string,
    referenceId: string,
    materialId: string,
  ) =>
    request(e2e.server)
      .patch(`${API}/requests/${requestId}/references/${referenceId}`)
      .set('Authorization', bearer(staff))
      .send({ materialId });

  const schedule = (requestId: string) =>
    request(e2e.server)
      .post(`${API}/requests/${requestId}/appointments`)
      .set('Authorization', bearer(staff))
      .send({ date: serviceDay() });

  const referencesOf = (requestId: string) =>
    e2e.prisma.requestReferenceModel.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });

  const historyOf = (requestId: string) =>
    e2e.prisma.statusHistoryModel.findMany({
      where: { requestId },
      orderBy: { id: 'asc' },
    });

  const requestsOfRequester = () =>
    e2e.prisma.requestModel.count({
      where: { requester: { userId: requester.userId } },
    });

  /** A request with only one written reference, moved to EN_BUSQUEDA. */
  const searchingWithReference = async (
    reference: Record<string, unknown> = FREE_TEXT,
  ) => {
    const created = (await fileRequest({ references: [reference] }).expect(201))
      .body as CreatedBody;
    await changeStatus(e2e.server, staff, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(200);
    const [stored] = await referencesOf(created.id);
    return { created, referenceId: stored.id };
  };

  beforeAll(async () => {
    e2e = await createE2eApp();
    requester = await signUpPublicUser(e2e.server, 'referencia');
    staff = await signInStaffUser(e2e);
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('files a request with only a notarial reference: no items, the reference PENDIENTE', async () => {
    const response = await fileRequest({ references: [NOTARIAL] }).expect(201);
    const created = response.body as CreatedBody;

    expect(created.status).toBe('RECIBIDA');
    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true, references: true, statusHistory: true },
    });
    expect(stored.items).toEqual([]);
    expect(stored.references).toEqual([
      expect.objectContaining({
        kind: 'PROTOCOLO_NOTARIAL',
        notary: 'Notaría Primera de Barranquilla',
        deedYear: 1950,
        deedNumber: '245',
        description: null,
        status: 'PENDIENTE',
        materialId: null,
        resolvedById: null,
        resolvedAt: null,
      }),
    ]);
    expect(stored.statusHistory).toHaveLength(1);
  });

  it('answers 400 to a request without materials nor references and saves nothing (RN-04)', async () => {
    const before = await requestsOfRequester();

    const response = await fileRequest({
      materialIds: [],
      references: [],
    }).expect(400);

    expect((response.body as ErrorBody).code).toBe(
      'REQUEST_MATERIALS_REQUIRED',
    );
    expect(await requestsOfRequester()).toBe(before);
  });

  it('answers 400 to an incomplete notarial reference and saves nothing', async () => {
    const before = await requestsOfRequester();

    await fileRequest({
      references: [{ kind: 'PROTOCOLO_NOTARIAL', notary: 'Notaría 2' }],
    }).expect(400);

    expect(await requestsOfRequester()).toBe(before);
  });

  it('lets the staff register a request with a catalog material and a free text reference (HU-10.1)', async () => {
    const material = await createMaterial(e2e.prisma);

    const response = await request(e2e.server)
      .post(`${API}/requests/on-behalf`)
      .set('Authorization', bearer(staff))
      .send({
        materialIds: [material.id],
        references: [FREE_TEXT],
        reason: 'Consulta para un trabajo de investigación',
        desiredDate: validDesiredDate(),
        deliveryMode: 'PRESENCIAL',
        requester: { email: requester.email },
      })
      .expect(201);

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: (response.body as CreatedBody).id },
      include: { items: true, references: true },
    });
    expect(stored.items.map(({ materialId }) => materialId)).toEqual([
      material.id,
    ]);
    expect(stored.references).toEqual([
      expect.objectContaining({
        kind: 'TEXTO_LIBRE',
        description: 'El Heraldo, 15-03-1950',
        status: 'PENDIENTE',
      }),
    ]);
  });

  it('files a request with several references and catalog materials', async () => {
    const material = await createMaterial(e2e.prisma);

    const created = (
      await fileRequest({
        materialIds: [material.id],
        references: [NOTARIAL, FREE_TEXT],
      }).expect(201)
    ).body as CreatedBody;

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true, references: { orderBy: { kind: 'asc' } } },
    });
    expect(stored.items.map(({ materialId }) => materialId)).toEqual([
      material.id,
    ]);
    expect(stored.references.map(({ kind, status }) => [kind, status])).toEqual(
      [
        ['PROTOCOLO_NOTARIAL', 'PENDIENTE'],
        ['TEXTO_LIBRE', 'PENDIENTE'],
      ],
    );
  });

  it('answers 400 to DISPONIBLE with a reference without material and no comment, and saves nothing', async () => {
    const { created } = await searchingWithReference();
    const historyBefore = await historyOf(created.id);
    const emailsOf = () =>
      e2e.prisma.notificationModel.count({ where: { requestId: created.id } });
    const emailsBefore = await emailsOf();

    const response = await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
    }).expect(400);

    expect((response.body as ErrorBody).code).toBe('DELIVERY_COMMENT_REQUIRED');
    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.status).toBe('EN_BUSQUEDA');
    expect(await historyOf(created.id)).toEqual(historyBefore);
    expect(await emailsOf()).toBe(emailsBefore);
  });

  it('makes a request with only references DISPONIBLE with a comment and schedules it without materials', async () => {
    const { created } = await searchingWithReference();
    const comment = 'Localizada en físico, se consulta en sala';

    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
      comment,
    }).expect(200);

    const history = await historyOf(created.id);
    expect(history[history.length - 1]).toMatchObject({
      previousStatus: 'EN_BUSQUEDA',
      newStatus: 'DISPONIBLE',
      userId: staff.userId,
      comment,
    });
    const disponibleNotification =
      await e2e.prisma.notificationModel.findUniqueOrThrow({
        where: { statusHistoryId: history[history.length - 1].id },
      });
    expect(disponibleNotification).toMatchObject({
      recipientEmail: requester.email,
      template: 'SOLICITUD_DISPONIBLE',
      deliveryStatus: 'PENDIENTE',
    });
    expect(disponibleNotification.body).toContain('- El Heraldo, 15-03-1950');
    expect(disponibleNotification.body).toContain(
      `Observaciones del personal:\n${comment}`,
    );
    // Delivered without the catalog: the reference keeps no material
    const [reference] = await referencesOf(created.id);
    expect(reference).toMatchObject({ status: 'PENDIENTE', materialId: null });

    // HU-18: the appointment is made with the materials of the request, here none
    await schedule(created.id).expect(201);
    const [appointment, ...others] = await e2e.prisma.appointmentModel.findMany(
      { where: { requestId: created.id }, include: { materials: true } },
    );
    expect(others).toHaveLength(0);
    expect(appointment).toMatchObject({ status: 'PROGRAMADA' });
    expect(appointment.materials).toEqual([]);
    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.status).toBe('AGENDADA');
  });

  it('still allows RECHAZADA with a reference without material', async () => {
    const { created } = await searchingWithReference();

    await changeStatus(e2e.server, staff, created.id, {
      status: 'RECHAZADA',
      comment: 'El material no existe en el archivo',
    }).expect(200);
  });

  it('associates the catalog material: reference RESUELTA, item added and history with who did it', async () => {
    const { created, referenceId } = await searchingWithReference();
    const material = await createMaterial(e2e.prisma, 'El Heraldo, 15-03-1950');

    const response = await resolve(created.id, referenceId, material.id).expect(
      200,
    );

    expect(response.body).toMatchObject({
      requestId: created.id,
      reference: {
        id: referenceId,
        label: 'El Heraldo, 15-03-1950',
        status: 'RESUELTA',
        material: { id: material.id, catalogCode: material.catalogCode },
        resolvedBy: { id: staff.userId },
      },
      historyEntry: {
        previousStatus: 'EN_BUSQUEDA',
        newStatus: 'EN_BUSQUEDA',
        changedBy: { id: staff.userId },
      },
    });

    const [reference] = await referencesOf(created.id);
    expect(reference).toMatchObject({
      status: 'RESUELTA',
      materialId: material.id,
      resolvedById: staff.userId,
    });
    expect(reference.resolvedAt).toBeInstanceOf(Date);
    const items = await e2e.prisma.requestItemModel.findMany({
      where: { requestId: created.id },
    });
    expect(items.map(({ materialId }) => materialId)).toEqual([material.id]);
    const history = await historyOf(created.id);
    expect(history[history.length - 1]).toMatchObject({
      previousStatus: 'EN_BUSQUEDA',
      newStatus: 'EN_BUSQUEDA',
      userId: staff.userId,
      comment: `Referencia «El Heraldo, 15-03-1950» asociada al material ${material.catalogCode} · El Heraldo, 15-03-1950`,
    });

    // With every reference resolved no comment is asked, and the
    // appointment books the associated material
    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
    }).expect(200);
    const disponibleNotification =
      await e2e.prisma.notificationModel.findFirstOrThrow({
        where: { requestId: created.id, template: 'SOLICITUD_DISPONIBLE' },
      });
    expect(disponibleNotification.body).toContain(
      `- ${material.catalogCode} · El Heraldo, 15-03-1950`,
    );
    expect(
      disponibleNotification.body.match(/El Heraldo, 15-03-1950/g),
    ).toHaveLength(1);
    expect(disponibleNotification.body).not.toContain(
      '\n- El Heraldo, 15-03-1950',
    );
    await schedule(created.id).expect(201);
    const [appointment] = await e2e.prisma.appointmentModel.findMany({
      where: { requestId: created.id },
      include: { materials: true },
    });
    expect(appointment.materials.map(({ materialId }) => materialId)).toEqual([
      material.id,
    ]);
  });

  it('answers 409 to a second association and changes nothing', async () => {
    const { created, referenceId } = await searchingWithReference();
    const first = await createMaterial(e2e.prisma);
    const second = await createMaterial(e2e.prisma);
    await resolve(created.id, referenceId, first.id).expect(200);
    const historyBefore = await historyOf(created.id);

    const response = await resolve(created.id, referenceId, second.id).expect(
      409,
    );

    expect((response.body as ErrorBody).code).toBe(
      'MATERIAL_REFERENCE_ALREADY_RESOLVED',
    );
    const [reference] = await referencesOf(created.id);
    expect(reference.materialId).toBe(first.id);
    expect(await historyOf(created.id)).toEqual(historyBefore);
    expect(
      await e2e.prisma.requestItemModel.count({
        where: { requestId: created.id },
      }),
    ).toBe(1);
  });

  it('answers 404 to a material that is not in the catalog and saves nothing', async () => {
    const { created, referenceId } = await searchingWithReference();
    const historyBefore = await historyOf(created.id);

    const response = await resolve(
      created.id,
      referenceId,
      '00000000-0000-4000-8000-000000000000',
    ).expect(404);

    expect((response.body as ErrorBody).code).toBe(
      'REQUEST_MATERIAL_NOT_FOUND',
    );
    const [reference] = await referencesOf(created.id);
    expect(reference.status).toBe('PENDIENTE');
    expect(await historyOf(created.id)).toEqual(historyBefore);
  });

  it('answers 409 to an association once the request is DISPONIBLE, and saves nothing', async () => {
    const { created, referenceId } = await searchingWithReference();
    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
      comment: 'Localizada en físico, se consulta en sala',
    }).expect(200);
    const historyBefore = await historyOf(created.id);
    const material = await createMaterial(e2e.prisma);

    const response = await resolve(created.id, referenceId, material.id).expect(
      409,
    );

    expect((response.body as ErrorBody).code).toBe(
      'MATERIAL_REFERENCE_NOT_RESOLVABLE',
    );
    const [reference] = await referencesOf(created.id);
    expect(reference).toMatchObject({
      status: 'PENDIENTE',
      materialId: null,
      resolvedById: null,
      resolvedAt: null,
    });
    expect(
      await e2e.prisma.requestItemModel.count({
        where: { requestId: created.id },
      }),
    ).toBe(0);
    expect(await historyOf(created.id)).toEqual(historyBefore);
  });

  it('forbids a public user from associating a material (403)', async () => {
    const { created, referenceId } = await searchingWithReference();
    const material = await createMaterial(e2e.prisma);

    await request(e2e.server)
      .patch(`${API}/requests/${created.id}/references/${referenceId}`)
      .set('Authorization', bearer(requester))
      .send({ materialId: material.id })
      .expect(403);
  });

  it('shows the references in the detail and filters the listing by pending references', async () => {
    const pending = await searchingWithReference(NOTARIAL);
    const resolved = await searchingWithReference();
    await resolve(
      resolved.created.id,
      resolved.referenceId,
      (await createMaterial(e2e.prisma)).id,
    ).expect(200);

    const detail = await request(e2e.server)
      .get(`${API}/requests/${pending.created.id}`)
      .set('Authorization', bearer(staff))
      .expect(200);
    expect((detail.body as { references: unknown[] }).references).toEqual([
      expect.objectContaining({
        id: pending.referenceId,
        kind: 'PROTOCOLO_NOTARIAL',
        label:
          'Protocolo notarial: Notaría Primera de Barranquilla, año 1950, escritura 245',
        status: 'PENDIENTE',
        displayStatus: 'PENDIENTE',
        material: null,
        resolvedBy: null,
      }),
    ]);
    expect(detail.body).toMatchObject({
      canResolveReferences: true,
      commentRequiredFor: ['DISPONIBLE', 'RECHAZADA'],
    });

    const list = await request(e2e.server)
      .get(`${API}/requests`)
      .query({
        pendingReferences: 'true',
        // Only this file's requests: other e2e files share the database
        requester: requester.email,
        limit: 100,
      })
      .set('Authorization', bearer(staff))
      .expect(200);
    const ids = (list.body as { items: { id: string }[] }).items.map(
      ({ id }) => id,
    );
    expect(ids).toContain(pending.created.id);
    expect(ids).not.toContain(resolved.created.id);

    // Past EN_BUSQUEDA a reference can no longer be resolved: it leaves the filter
    await changeStatus(e2e.server, staff, pending.created.id, {
      status: 'DISPONIBLE',
      comment: 'Se envió la copia por correo',
    }).expect(200);
    const afterSearch = await request(e2e.server)
      .get(`${API}/requests`)
      .query({
        pendingReferences: 'true',
        // Only this file's requests: other e2e files share the database
        requester: requester.email,
        limit: 100,
      })
      .set('Authorization', bearer(staff))
      .expect(200);
    expect(
      (afterSearch.body as { items: { id: string }[] }).items.map(
        ({ id }) => id,
      ),
    ).not.toContain(pending.created.id);
  });

  it('never counts a reference in the most requested materials report (HU-26)', async () => {
    const material = await createMaterial(e2e.prisma);
    const withMaterial = await submitRequest(e2e.server, requester, [
      material.id,
    ]);
    const onlyReference = (
      await fileRequest({ references: [FREE_TEXT] }).expect(201)
    ).body as CreatedBody;
    // Moved to a month no other file uses, so only these two are counted
    await e2e.prisma.requestModel.updateMany({
      where: { id: { in: [withMaterial.id, onlyReference.id] } },
      data: { registeredAt: new Date('1994-06-10T15:00:00.000Z') },
    });

    const response = await request(e2e.server)
      .get(`${API}/reports/most-requested-materials`)
      .query({ from: '1994-06-01', to: '1994-06-30' })
      .set('Authorization', bearer(staff))
      .expect(200);

    const body = response.body as {
      items: { materialId: string; requestCount: number }[];
    };
    expect(body.items).toEqual([
      expect.objectContaining({ materialId: material.id, requestCount: 1 }),
    ]);
  });
});
