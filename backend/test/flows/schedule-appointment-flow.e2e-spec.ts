import request from 'supertest';
import { formatAppointmentDate } from '../../src/requests/application/services/email-templates';
import {
  API,
  E2eApp,
  Session,
  bearer,
  changeStatus,
  createE2eApp,
  createMaterial,
  nextSunday,
  serviceDay,
  signInStaffUser,
  signUpPublicUser,
  submitRequest,
} from '../support/e2e-app';

interface ErrorBody {
  statusCode: number;
  code: string;
}

/**
 * «Agendar cita de consulta» (HU-18) against PostgreSQL (HU-41): the
 * appointment, the booking of each material for that day (D-09), the move to
 * AGENDADA, its history row and its email are saved together. A material
 * already booked that day is refused (HU-20).
 */
describe('Appointment scheduling flow, HU-18 (e2e, PostgreSQL)', () => {
  let e2e: E2eApp;
  let requester: Session;
  let staff: Session;

  /** A presential request made DISPONIBLE by the staff, ready to schedule. */
  const availableRequest = async (materialIds: string[]) => {
    const created = await submitRequest(e2e.server, requester, materialIds);
    await changeStatus(e2e.server, staff, created.id, {
      status: 'EN_BUSQUEDA',
    }).expect(200);
    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
    }).expect(200);
    return created;
  };

  const schedule = (requestId: string, date: string) =>
    request(e2e.server)
      .post(`${API}/requests/${requestId}/appointments`)
      .set('Authorization', bearer(staff))
      .send({ date });

  const historyOf = (requestId: string) =>
    e2e.prisma.statusHistoryModel.findMany({
      where: { requestId },
      orderBy: { id: 'asc' },
    });

  const outboxOf = (requestId: string) =>
    e2e.prisma.notificationModel.findMany({ where: { requestId } });

  /** The history of a request made DISPONIBLE and never scheduled. */
  const expectHistoryUntilDisponible = async (requestId: string) => {
    expect(await historyOf(requestId)).toEqual([
      expect.objectContaining({ previousStatus: null, newStatus: 'RECIBIDA' }),
      expect.objectContaining({
        previousStatus: 'RECIBIDA',
        newStatus: 'EN_BUSQUEDA',
      }),
      expect.objectContaining({
        previousStatus: 'EN_BUSQUEDA',
        newStatus: 'DISPONIBLE',
      }),
    ]);
  };

  const appointmentsOf = (requestId: string) =>
    e2e.prisma.appointmentModel.findMany({
      where: { requestId },
      include: { materials: true },
    });

  beforeAll(async () => {
    e2e = await createE2eApp();
    requester = await signUpPublicUser(e2e.server, 'cita');
    staff = await signInStaffUser(e2e);
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('schedules a DISPONIBLE request: saves the appointment, books the material and moves it to AGENDADA', async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await availableRequest([material.id]);
    const day = serviceDay();

    const response = await schedule(created.id, day).expect(201);

    expect(response.body).toMatchObject({
      id: created.id,
      status: 'AGENDADA',
      allowedTransitions: expect.arrayContaining([
        'ATENDIDA',
        'DISPONIBLE',
      ]) as unknown,
      appointment: {
        date: day,
        status: 'PROGRAMADA',
        materials: [{ id: material.id, catalogCode: material.catalogCode }],
      },
      statusChange: {
        previousStatus: 'DISPONIBLE',
        newStatus: 'AGENDADA',
        changedBy: { id: staff.userId },
      },
    });

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.status).toBe('AGENDADA');

    const [appointment, ...others] = await appointmentsOf(created.id);
    expect(others).toHaveLength(0);
    expect(appointment).toMatchObject({
      status: 'PROGRAMADA',
      scheduledById: staff.userId,
      requesterId: stored.requesterId,
    });
    expect(appointment.appointmentDate.toISOString().slice(0, 10)).toBe(day);
    // The material is booked for that day (unique index of D-09)
    expect(appointment.materials).toEqual([
      expect.objectContaining({ materialId: material.id }),
    ]);
    expect(
      appointment.materials[0].bookedDate?.toISOString().slice(0, 10),
    ).toBe(day);

    const lastChange = await e2e.prisma.statusHistoryModel.findFirstOrThrow({
      where: { requestId: created.id },
      orderBy: { id: 'desc' },
      include: { notification: true },
    });
    expect(lastChange).toMatchObject({
      previousStatus: 'DISPONIBLE',
      newStatus: 'AGENDADA',
      userId: staff.userId,
      notification: {
        recipientEmail: requester.email,
        template: 'SOLICITUD_AGENDADA',
        deliveryStatus: 'PENDIENTE',
      },
    });
  });

  it('lists the appointment in the calendar of the staff (HU-19)', async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await availableRequest([material.id]);
    const day = serviceDay(1);
    await schedule(created.id, day).expect(201);

    const response = await request(e2e.server)
      .get(`${API}/appointments`)
      .query({ from: day, to: day, material: material.catalogCode, limit: 100 })
      .set('Authorization', bearer(staff))
      .expect(200);

    const { items } = response.body as {
      items: Array<{ date: string; materials: Array<{ id: string }> }>;
    };
    expect(items).toEqual([
      expect.objectContaining({
        date: day,
        status: 'PROGRAMADA',
        request: expect.objectContaining({ id: created.id }) as unknown,
        materials: [expect.objectContaining({ id: material.id })],
      }),
    ]);
  });

  it('refuses a material already booked that day with 409 and saves nothing (HU-20)', async () => {
    const material = await createMaterial(e2e.prisma);
    const day = serviceDay(2);
    const first = await availableRequest([material.id]);
    await schedule(first.id, day).expect(201);
    const second = await availableRequest([material.id]);
    const emailsBefore = (await outboxOf(second.id)).length;

    const response = await schedule(second.id, day).expect(409);

    expect((response.body as ErrorBody).code).toBe('MATERIAL_ALREADY_BOOKED');
    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: second.id },
    });
    expect(stored.status).toBe('DISPONIBLE');
    expect(await appointmentsOf(second.id)).toHaveLength(0);
    // Neither the AGENDADA row nor its email were saved
    await expectHistoryUntilDisponible(second.id);
    expect(await outboxOf(second.id)).toHaveLength(emailsBefore);

    // Another day is free
    const retry = await schedule(second.id, serviceDay(3)).expect(201);
    expect(retry.body).toMatchObject({ id: second.id, status: 'AGENDADA' });
  });

  it('books a material only once when two requests are scheduled for the same day at the same time (D-09)', async () => {
    const material = await createMaterial(e2e.prisma);
    const day = serviceDay(5);
    const first = await availableRequest([material.id]);
    const second = await availableRequest([material.id]);

    const responses = await Promise.all([
      schedule(first.id, day),
      schedule(second.id, day),
    ]);

    // The pre-check or the unique index stops one of them
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const winnerIndex = responses.findIndex(({ status }) => status === 201);
    const winner = [first, second][winnerIndex];
    const loser = [first, second][1 - winnerIndex];
    expect((responses[1 - winnerIndex].body as ErrorBody).code).toBe(
      'MATERIAL_ALREADY_BOOKED',
    );

    const bookings = await e2e.prisma.appointmentMaterialModel.findMany({
      where: { materialId: material.id, bookedDate: new Date(day) },
      include: { appointment: true },
    });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].appointment.requestId).toBe(winner.id);

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: loser.id },
    });
    expect(stored.status).toBe('DISPONIBLE');
    expect(await appointmentsOf(loser.id)).toHaveLength(0);
    await expectHistoryUntilDisponible(loser.id);
  });

  it('refuses a Sunday with 400 INVALID_APPOINTMENT_DATE', async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await availableRequest([material.id]);

    const response = await schedule(created.id, nextSunday()).expect(400);

    expect((response.body as ErrorBody).code).toBe('INVALID_APPOINTMENT_DATE');
    expect(await appointmentsOf(created.id)).toHaveLength(0);
  });

  it('refuses a request that is not DISPONIBLE with 409', async () => {
    const material = await createMaterial(e2e.prisma);
    const created = await submitRequest(e2e.server, requester, [material.id]);

    const response = await schedule(created.id, serviceDay()).expect(409);

    expect((response.body as ErrorBody).code).toBe('INVALID_STATUS_TRANSITION');
    expect(await appointmentsOf(created.id)).toHaveLength(0);
  });

  it('moves a scheduled request back to DISPONIBLE when the requester did not attend, freeing the day', async () => {
    const material = await createMaterial(e2e.prisma);
    const day = serviceDay(4);
    const created = await availableRequest([material.id]);
    await schedule(created.id, day).expect(201);

    await changeStatus(e2e.server, staff, created.id, {
      status: 'DISPONIBLE',
    }).expect(200);

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.status).toBe('DISPONIBLE');
    const history = await historyOf(created.id);
    expect(history[history.length - 1]).toMatchObject({
      previousStatus: 'AGENDADA',
      newStatus: 'DISPONIBLE',
      userId: staff.userId,
    });

    const [appointment] = await appointmentsOf(created.id);
    expect(appointment.status).toBe('NO_ASISTIO');
    expect(appointment.materials[0].bookedDate).toBeNull();
    // The material can be booked again that same day
    const other = await availableRequest([material.id]);
    const rebooked = await schedule(other.id, day).expect(201);
    expect(rebooked.body).toMatchObject({
      id: other.id,
      status: 'AGENDADA',
      appointment: { date: day },
    });
  });

  it('reschedules an appointment to another day, re-validates availability and records it in history (HU-21)', async () => {
    const material = await createMaterial(e2e.prisma);
    const originalDay = serviceDay(10);
    const busyDay = serviceDay(11);
    const freeDay = serviceDay(12);

    const first = await availableRequest([material.id]);
    const scheduled = await schedule(first.id, originalDay).expect(201);
    const appointmentId = (scheduled.body as { appointment: { id: string } })
      .appointment.id;

    // Another request books the same material on busyDay
    const second = await availableRequest([material.id]);
    await schedule(second.id, busyDay).expect(201);

    // Rescheduling to busyDay fails availability check (409 MATERIAL_ALREADY_BOOKED)
    const conflict = await request(e2e.server)
      .patch(`${API}/appointments/${appointmentId}/reschedule`)
      .set('Authorization', bearer(staff))
      .send({ date: busyDay })
      .expect(409);
    expect((conflict.body as ErrorBody).code).toBe('MATERIAL_ALREADY_BOOKED');

    // Rescheduling to freeDay succeeds, frees originalDay and records in status_history
    const rescheduled = await request(e2e.server)
      .patch(`${API}/appointments/${appointmentId}/reschedule`)
      .set('Authorization', bearer(staff))
      .send({ date: freeDay })
      .expect(200);

    expect(rescheduled.body).toMatchObject({
      id: first.id,
      status: 'AGENDADA',
      appointment: {
        id: appointmentId,
        date: freeDay,
        status: 'PROGRAMADA',
      },
      statusChange: {
        previousStatus: 'AGENDADA',
        newStatus: 'AGENDADA',
      },
    });

    const lastReschedule = await e2e.prisma.statusHistoryModel.findFirstOrThrow(
      {
        where: { requestId: first.id },
        orderBy: { id: 'desc' },
        include: { notification: true },
      },
    );
    expect(lastReschedule).toMatchObject({
      previousStatus: 'AGENDADA',
      newStatus: 'AGENDADA',
      userId: staff.userId,
      comment: `Cita reprogramada del ${originalDay} al ${freeDay}`,
      notification: {
        recipientEmail: requester.email,
        template: 'CITA_REPROGRAMADA',
        deliveryStatus: 'PENDIENTE',
      },
    });
    expect(lastReschedule.notification?.body).toContain(
      `Fecha anterior: ${formatAppointmentDate(new Date(`${originalDay}T00:00:00.000Z`))}`,
    );
    expect(lastReschedule.notification?.body).toContain(
      `Nueva fecha de la cita: ${formatAppointmentDate(new Date(`${freeDay}T00:00:00.000Z`))}`,
    );
    expect(lastReschedule.notification?.body).not.toContain(
      'Observaciones del personal',
    );

    // originalDay is now free for another request with that material
    const third = await availableRequest([material.id]);
    await schedule(third.id, originalDay).expect(201);
  });

  it('cancels an appointment, frees the material, returns the request to DISPONIBLE and records it in history (HU-21)', async () => {
    const material = await createMaterial(e2e.prisma);
    const day = serviceDay(15);
    const created = await availableRequest([material.id]);
    const scheduled = await schedule(created.id, day).expect(201);
    const appointmentId = (scheduled.body as { appointment: { id: string } })
      .appointment.id;

    // Public user receives 403
    await request(e2e.server)
      .patch(`${API}/appointments/${appointmentId}/cancel`)
      .set('Authorization', bearer(requester))
      .send({})
      .expect(403);

    const cancelled = await request(e2e.server)
      .patch(`${API}/appointments/${appointmentId}/cancel`)
      .set('Authorization', bearer(staff))
      .send({})
      .expect(200);

    expect(cancelled.body).toMatchObject({
      id: created.id,
      status: 'DISPONIBLE',
      allowedTransitions: ['AGENDADA', 'CERRADA'],
      appointment: {
        id: appointmentId,
        date: day,
        status: 'CANCELADA',
      },
      statusChange: {
        previousStatus: 'AGENDADA',
        newStatus: 'DISPONIBLE',
      },
    });

    const stored = await e2e.prisma.requestModel.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.status).toBe('DISPONIBLE');

    const [appointment] = await appointmentsOf(created.id);
    expect(appointment.status).toBe('CANCELADA');
    expect(appointment.materials[0].bookedDate).toBeNull();

    const lastCancel = await e2e.prisma.statusHistoryModel.findFirstOrThrow({
      where: { requestId: created.id },
      orderBy: { id: 'desc' },
      include: { notification: true },
    });
    expect(lastCancel).toMatchObject({
      previousStatus: 'AGENDADA',
      newStatus: 'DISPONIBLE',
      userId: staff.userId,
      comment: `Cita del ${day} cancelada`,
      notification: {
        recipientEmail: requester.email,
        template: 'CITA_CANCELADA',
        deliveryStatus: 'PENDIENTE',
      },
    });
    expect(lastCancel.notification?.body).toContain('se canceló');
    expect(lastCancel.notification?.body).toContain(
      `Fecha de la cita cancelada: ${formatAppointmentDate(new Date(`${day}T00:00:00.000Z`))}`,
    );
    expect(lastCancel.notification?.body).not.toContain(
      'Observaciones del personal',
    );

    // Another request can now book that material on the same day
    const other = await availableRequest([material.id]);
    await schedule(other.id, day).expect(201);
  });
});
