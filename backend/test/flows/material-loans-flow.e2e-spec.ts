import request from 'supertest';
import { todayInBogota } from '../../src/requests/domain/value-objects/desired-date';
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
} from '../support/e2e-app';

interface LoanBody {
  id: string;
  materialId: string;
  materialStatus: string;
  appointment: { id: string; date: string; trackingCode: string };
  requester: { id: string; name: string };
  handedOverAt: string;
  handedOverBy: { id: string; name: string };
  deliveryNotes: string | null;
  returnedAt: string | null;
  returnedBy: { id: string; name: string } | null;
  returnNotes: string | null;
}

interface HistoryBody {
  material: { id: string; status: string };
  lastLoan: LoanBody | null;
  items: LoanBody[];
  page: number;
  limit: number;
  total: number;
}

/**
 * «Entrega, devolución e historial de custodia de material» (HU-72) against
 * real PostgreSQL. Verifies delivery on today's appointment, return, repeated
 * loans on the same appointment, custody history, role restrictions, manual
 * EN_USO removal, and appointment/request lifecycle safeguards.
 */
describe('Material delivery, return and history flow, HU-72 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let requester: Session;
  let staff: Session;
  let receiverStaff: Session;
  let admin: Session;
  let todayIso: string;

  const scheduleForDay = async (materialIds: string[], dateIso: string) => {
    const created = await submitRequest(e2e.server, requester, materialIds);
    await changeStatus(e2e.server, staff, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(200);
    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
    }).expect(200);
    const scheduled = await request(e2e.server)
      .post(`${API}/requests/${created.id}/appointments`)
      .set('Authorization', bearer(staff))
      .send({ date: dateIso })
      .expect(201);
    const body = scheduled.body as { appointment: { id: string } };
    return { requestId: created.id, appointmentId: body.appointment.id };
  };

  beforeAll(async () => {
    // Appointments cannot be scheduled on Sunday (CHECK in appointments): if
    // the suite runs on a Sunday in America/Bogota, advance only Date to Monday.
    if (todayInBogota().getUTCDay() === 0) {
      const mondayNoonUtc = new Date(
        todayInBogota().getTime() + 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000,
      );
      jest.useFakeTimers({
        doNotFake: [
          'nextTick',
          'setImmediate',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'hrtime',
          'performance',
        ],
        now: mondayNoonUtc,
      });
    }
    todayIso = todayInBogota().toISOString().slice(0, 10);

    e2e = await createE2eApp();
    requester = await signUpPublicUser(e2e.server, 'prestamo');
    staff = await signInStaffUser(e2e, 'PERSONAL');
    receiverStaff = await signInStaffUser(e2e, 'PERSONAL');
    admin = await signInStaffUser(e2e, 'ADMIN');
  });

  afterAll(async () => {
    await e2e.app.close();
    jest.useRealTimers();
  });

  it('rejects PUBLICO users with 403 on deliver, return and history endpoints', async () => {
    const material = await createMaterial(e2e.prisma);
    const { appointmentId } = await scheduleForDay([material.id], todayIso);

    await request(e2e.server)
      .post(
        `${API}/appointments/${appointmentId}/materials/${material.id}/deliver`,
      )
      .set('Authorization', bearer(requester))
      .send({})
      .expect(403);

    await request(e2e.server)
      .post(`${API}/materials/${material.id}/return`)
      .set('Authorization', bearer(requester))
      .send({})
      .expect(403);

    await request(e2e.server)
      .get(`${API}/materials/${material.id}/history`)
      .set('Authorization', bearer(requester))
      .expect(403);
  });

  it('records delivery, blocks manual status while EN_USO, records return, allows a second loan in the same appointment and exposes custody history', async () => {
    const material = await createMaterial(e2e.prisma);
    const { requestId, appointmentId } = await scheduleForDay(
      [material.id],
      todayIso,
    );

    // 1. Manual EN_USO is rejected with 400
    await request(e2e.server)
      .patch(`${API}/materials/${material.id}/status`)
      .set('Authorization', bearer(staff))
      .send({ status: 'EN_USO' })
      .expect(400);

    // 2. Deliver the material on today's appointment
    const delivered = await request(e2e.server)
      .post(
        `${API}/appointments/${appointmentId}/materials/${material.id}/deliver`,
      )
      .set('Authorization', bearer(staff))
      .send({ notes: 'Entregado con guantes' })
      .expect(201);

    const firstLoan = delivered.body as LoanBody;
    expect(firstLoan).toMatchObject({
      materialId: material.id,
      materialStatus: 'EN_USO',
      appointment: { id: appointmentId, date: todayIso },
      handedOverBy: { id: staff.userId },
      deliveryNotes: 'Entregado con guantes',
      returnedAt: null,
      returnedBy: null,
    });

    // 3. While EN_USO: manual status change, duplicate delivery and settling to ATENDIDA fail with 409
    await request(e2e.server)
      .patch(`${API}/materials/${material.id}/status`)
      .set('Authorization', bearer(staff))
      .send({ status: 'EN_RESTAURACION' })
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => {
        expect(body.code).toBe('MATERIAL_IN_USE');
      });

    await request(e2e.server)
      .post(
        `${API}/appointments/${appointmentId}/materials/${material.id}/deliver`,
      )
      .set('Authorization', bearer(staff))
      .send({})
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => {
        expect(body.code).toBe('MATERIAL_IN_USE');
      });

    await changeStatus(e2e.server, staff, requestId, { status: 'ATENDIDA' })
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => {
        expect(body.code).toBe('APPOINTMENT_HAS_UNRETURNED_MATERIALS');
      });

    // 4. Register return (by another staff member) -> material returns to DISPONIBLE
    const returned = await request(e2e.server)
      .post(`${API}/materials/${material.id}/return`)
      .set('Authorization', bearer(receiverStaff))
      .send({ notes: 'Devuelto sin novedad' })
      .expect(200);

    const closedFirstLoan = returned.body as LoanBody;
    expect(closedFirstLoan).toMatchObject({
      id: firstLoan.id,
      materialStatus: 'DISPONIBLE',
      returnedBy: { id: receiverStaff.userId },
      returnNotes: 'Devuelto sin novedad',
    });
    expect(closedFirstLoan.returnedAt).toEqual(expect.any(String));

    // 5. Same material can be delivered again in the same appointment after return
    const secondDelivered = await request(e2e.server)
      .post(
        `${API}/appointments/${appointmentId}/materials/${material.id}/deliver`,
      )
      .set('Authorization', bearer(admin))
      .send({ notes: 'Segunda consulta en la tarde' })
      .expect(201);
    const secondLoan = secondDelivered.body as LoanBody;
    expect(secondLoan.id).not.toBe(firstLoan.id);
    expect(secondLoan.materialStatus).toBe('EN_USO');

    await request(e2e.server)
      .post(`${API}/materials/${material.id}/return`)
      .set('Authorization', bearer(admin))
      .send({})
      .expect(200);

    // 6. Query material custody history: latest first with who had it and when it was returned
    const historyResponse = await request(e2e.server)
      .get(`${API}/materials/${material.id}/history`)
      .set('Authorization', bearer(staff))
      .expect(200);

    const history = historyResponse.body as HistoryBody;
    expect(history.material).toMatchObject({
      id: material.id,
      status: 'DISPONIBLE',
    });
    expect(history.total).toBe(2);
    expect(history.items).toHaveLength(2);
    expect(history.lastLoan?.id).toBe(secondLoan.id);
    expect(history.lastLoan?.requester.name).toBe('Ana María Pérez Gómez');
    expect(history.lastLoan?.returnedAt).toEqual(expect.any(String));
    expect(history.items[0].id).toBe(secondLoan.id);
    expect(history.items[1].id).toBe(firstLoan.id);

    // 7. Safeguards: cancel, reschedule and NO_ASISTIO are blocked once the appointment had loans
    await request(e2e.server)
      .patch(`${API}/appointments/${appointmentId}/cancel`)
      .set('Authorization', bearer(staff))
      .send({})
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => {
        expect(body.code).toBe('APPOINTMENT_HAS_LOANS');
      });

    await request(e2e.server)
      .patch(`${API}/appointments/${appointmentId}/reschedule`)
      .set('Authorization', bearer(staff))
      .send({ date: serviceDay(5) })
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => {
        expect(body.code).toBe('APPOINTMENT_HAS_LOANS');
      });

    await changeStatus(e2e.server, staff, requestId, { status: 'DISPONIBLE' })
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => {
        expect(body.code).toBe('APPOINTMENT_HAS_LOANS');
      });

    // 8. Once all materials are returned, marking the request ATENDIDA succeeds
    await changeStatus(e2e.server, staff, requestId, {
      status: 'ATENDIDA',
    }).expect(200);
  });

  it('rejects delivery for an appointment scheduled for another day with 409', async () => {
    const material = await createMaterial(e2e.prisma);
    const futureDay = serviceDay(3);
    const { appointmentId } = await scheduleForDay([material.id], futureDay);

    await request(e2e.server)
      .post(
        `${API}/appointments/${appointmentId}/materials/${material.id}/deliver`,
      )
      .set('Authorization', bearer(staff))
      .send({})
      .expect(409)
      .expect(({ body }: { body: { code: string } }) => {
        expect(body.code).toBe('APPOINTMENT_NOT_TODAY');
      });
  });
});
