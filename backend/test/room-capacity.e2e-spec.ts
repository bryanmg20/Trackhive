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
} from './support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/**
 * «Configurar capacidad diaria de la sala» (HU-20.1, RN-19) against real
 * PostgreSQL: default 15/day, ADMIN-only writes (403 to PERSONAL/PUBLICO),
 * active appointment counting (PROGRAMADA/CUMPLIDA occupy, NO_ASISTIO/CANCELADA
 * release), preserving existing bookings on reduction, and concurrent last-slot
 * locking.
 */
describe('Reading room daily capacity, HU-20.1 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let publicUser: Session;
  let staffUser: Session;
  let adminUser: Session;

  const availableRequest = async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await submitRequest(e2e.server, publicUser, [material.id]);
    await changeStatus(e2e.server, staffUser, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(200);
    await changeStatus(e2e.server, staffUser, created.id, {
      status: 'DISPONIBLE',
    }).expect(200);
    return created;
  };

  const schedule = (requestId: string, date: string) =>
    request(e2e.server)
      .post(`${API}/requests/${requestId}/appointments`)
      .set('Authorization', bearer(staffUser))
      .send({ date });

  const getCapacity = (session: Session) =>
    request(e2e.server)
      .get(`${API}/appointments/capacity`)
      .set('Authorization', bearer(session));

  const putCapacity = (session: Session, dailyCapacity: unknown) =>
    request(e2e.server)
      .put(`${API}/appointments/capacity`)
      .set('Authorization', bearer(session))
      .send({ dailyCapacity });

  beforeAll(async () => {
    e2e = await createE2eApp();
    publicUser = await signUpPublicUser(e2e.server, 'cap-pub');
    staffUser = await signInStaffUser(e2e, 'PERSONAL');
    adminUser = await signInStaffUser(e2e, 'ADMIN');
  });

  beforeEach(async () => {
    await e2e.prisma.readingRoomConfigModel.deleteMany();
  });

  afterAll(async () => {
    await e2e.prisma.readingRoomConfigModel.deleteMany();
    await e2e.app.close();
  });

  it('defaults to 15 appointments per day when unconfigured and blocks the 16th', async () => {
    const initial = await getCapacity(adminUser).expect(200);
    expect(initial.body).toEqual({
      dailyCapacity: 15,
      isDefault: true,
      updatedAt: null,
      updatedBy: null,
    });

    const day = serviceDay(180);
    for (let index = 0; index < 15; index += 1) {
      const req = await availableRequest();
      await schedule(req.id, day).expect(201);
    }

    const sixteenth = await availableRequest();
    const rejected = await schedule(sixteenth.id, day).expect(409);
    expect((rejected.body as ErrorBody).code).toBe('ROOM_CAPACITY_EXCEEDED');

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: sixteenth.id },
    });
    expect(stored.status).toBe('DISPONIBLE');
  });

  it('allows ADMIN to update capacity, validates positive integers and enforces 403 for PERSONAL and PUBLICO', async () => {
    await putCapacity(staffUser, 10).expect(403);
    await putCapacity(publicUser, 10).expect(403);
    await getCapacity(publicUser).expect(403);
    await getCapacity(staffUser).expect(200);

    await putCapacity(adminUser, 0).expect(400);
    await putCapacity(adminUser, -2).expect(400);
    await putCapacity(adminUser, 3.5).expect(400);
    await putCapacity(adminUser, '10').expect(400);

    const updated = await putCapacity(adminUser, 2).expect(200);
    expect(updated.body).toMatchObject({
      dailyCapacity: 2,
      isDefault: false,
      updatedBy: { id: adminUser.userId, name: 'Carlos Rodríguez' },
    });

    const day = serviceDay(190);
    const first = await availableRequest();
    const second = await availableRequest();
    const third = await availableRequest();

    await schedule(first.id, day).expect(201);
    await schedule(second.id, day).expect(201);
    const blocked = await schedule(third.id, day).expect(409);
    expect((blocked.body as ErrorBody).code).toBe('ROOM_CAPACITY_EXCEEDED');
  });

  it('counts PROGRAMADA and CUMPLIDA, frees slots on NO_ASISTIO/CANCELADA, and preserves existing appointments when reduced', async () => {
    await putCapacity(adminUser, 3).expect(200);
    const day = serviceDay(200);

    const first = await availableRequest();
    const second = await availableRequest();
    const third = await availableRequest();
    await schedule(first.id, day).expect(201);
    await schedule(second.id, day).expect(201);
    await schedule(third.id, day).expect(201);

    // Lower capacity below existing 3 appointments: existing 3 stay PROGRAMADA
    await putCapacity(adminUser, 2).expect(200);
    const existingAppointments = await e2e.prisma.appointmentModel.findMany({
      where: { appointmentDate: new Date(`${day}T00:00:00.000Z`) },
    });
    expect(existingAppointments).toHaveLength(3);
    expect(existingAppointments.every((a) => a.status === 'PROGRAMADA')).toBe(
      true,
    );

    const extra = await availableRequest();
    await schedule(extra.id, day).expect(409);

    // Mark first as ATENDIDA (appointment becomes CUMPLIDA): still occupies 1 slot (total 3 >= 2)
    await changeStatus(e2e.server, staffUser, first.id, {
      status: 'ATENDIDA',
    }).expect(200);
    await schedule(extra.id, day).expect(409);

    // Mark second and third as DISPONIBLE (appointments become NO_ASISTIO):
    // occupied drops from 3 to 1 (< 2), freeing a slot for extra
    await changeStatus(e2e.server, staffUser, second.id, {
      status: 'DISPONIBLE',
    }).expect(200);
    await changeStatus(e2e.server, staffUser, third.id, {
      status: 'DISPONIBLE',
    }).expect(200);

    const occupancy = await request(e2e.server)
      .get(`${API}/appointments/occupancy`)
      .query({ from: day, to: day })
      .set('Authorization', bearer(staffUser))
      .expect(200);
    expect(occupancy.body).toEqual({
      dailyCapacity: 2,
      days: [{ date: day, occupied: 1, available: 1, isFull: false }],
    });

    await schedule(extra.id, day).expect(201);
  });

  it('prevents two concurrent bookings from exceeding the last remaining slot', async () => {
    await putCapacity(adminUser, 1).expect(200);
    const day = serviceDay(210);
    const first = await availableRequest();
    const second = await availableRequest();

    const responses = await Promise.all([
      schedule(first.id, day),
      schedule(second.id, day),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const loser = responses.find((r) => r.status === 409);
    expect((loser?.body as ErrorBody).code).toBe('ROOM_CAPACITY_EXCEEDED');
  });
});
