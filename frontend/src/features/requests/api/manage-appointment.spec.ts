import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestsApiError } from './list-requests';
import { cancelAppointment, rescheduleAppointment } from './manage-appointment';

const fetchMock = vi.fn();

describe('manage-appointment API (HU-21)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'token-123');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends PATCH /api/v1/appointments/:id/reschedule with the new date and optional comment', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'request-1',
        status: 'AGENDADA',
        allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
        appointment: {
          id: 'appointment-1',
          date: '2026-11-24',
          serviceHours: { opensAt: '08:00', closesAt: '17:00' },
          status: 'PROGRAMADA',
          requester: { id: 'req-1', name: 'Juan Pérez' },
          materials: [],
        },
        statusChange: {
          previousStatus: 'AGENDADA',
          newStatus: 'AGENDADA',
          changedAt: '2026-11-18T15:00:00.000Z',
          changedBy: { id: 'staff-1', name: 'Ana Gómez' },
          comment: 'Cambio de último momento',
        },
      }),
    });

    const result = await rescheduleAppointment({
      appointmentId: 'appointment-1',
      date: '2026-11-24',
      comment: 'Cambio de último momento',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/appointments/appointment-1/reschedule',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          date: '2026-11-24',
          comment: 'Cambio de último momento',
        }),
      }),
    );
    expect(result.appointment.date).toBe('2026-11-24');
  });

  it('throws RequestsApiError with the backend message on availability conflict (409)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        statusCode: 409,
        code: 'MATERIAL_ALREADY_BOOKED',
        message:
          'El material «Acta de fundación» (TH-DOC-0001) ya tiene cita el martes, 24 de noviembre de 2026 (solicitud SOL-2026-00002).',
      }),
    });

    await expect(
      rescheduleAppointment({
        appointmentId: 'appointment-1',
        date: '2026-11-24',
      }),
    ).rejects.toThrow(
      new RequestsApiError(
        'El material «Acta de fundación» (TH-DOC-0001) ya tiene cita el martes, 24 de noviembre de 2026 (solicitud SOL-2026-00002).',
        409,
      ),
    );
  });

  it('sends PATCH /api/v1/appointments/:id/cancel and returns the CANCELADA appointment', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'request-1',
        status: 'DISPONIBLE',
        allowedTransitions: ['AGENDADA', 'CERRADA'],
        appointment: {
          id: 'appointment-1',
          date: '2026-11-20',
          status: 'CANCELADA',
        },
        statusChange: {
          previousStatus: 'AGENDADA',
          newStatus: 'DISPONIBLE',
          changedAt: '2026-11-18T15:00:00.000Z',
          changedBy: { id: 'staff-1', name: 'Ana Gómez' },
          comment: 'Cita del 2026-11-20 cancelada',
        },
      }),
    });

    const result = await cancelAppointment({
      appointmentId: 'appointment-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/appointments/appointment-1/cancel',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
    );
    expect(result.status).toBe('DISPONIBLE');
    expect(result.appointment.status).toBe('CANCELADA');
  });
});
