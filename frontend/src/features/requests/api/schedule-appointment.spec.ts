import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestsApiError } from './list-requests';
import { scheduleAppointment } from './schedule-appointment';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const RESULT = {
  id: 'request-1',
  status: 'AGENDADA',
  allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
  appointment: {
    id: 'appointment-1',
    date: '2026-11-20',
    serviceHours: { opensAt: '08:00', closesAt: '17:00' },
    status: 'PROGRAMADA',
    requester: { id: 'requester-1', name: 'Juan Pérez' },
    materials: [{ id: 'material-1', catalogCode: 'AHB-001', title: 'Actas' }],
  },
  statusChange: {
    previousStatus: 'DISPONIBLE',
    newStatus: 'AGENDADA',
    changedAt: '2026-11-10T15:30:00.000Z',
    changedBy: { id: 'staff-1', name: 'Ana Gómez' },
    comment: null,
  },
};

describe('scheduleAppointment', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'access-token');
  });

  it('sends POST /requests/:id/appointments with the date and the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, RESULT));

    const result = await scheduleAppointment({
      requestId: 'request-1',
      date: '2026-11-20',
    });

    expect(result).toEqual(RESULT);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/requests/request-1/appointments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ date: '2026-11-20' });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-token',
    );
  });

  it('throws the backend message and status when the day is a Sunday (400)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        code: 'INVALID_APPOINTMENT_DATE',
        message:
          'El CLENA no atiende los domingos. Elija una fecha de lunes a sábado.',
      }),
    );

    const error = await scheduleAppointment({
      requestId: 'request-1',
      date: '2026-11-22',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RequestsApiError);
    expect(error).toMatchObject({
      status: 400,
      message:
        'El CLENA no atiende los domingos. Elija una fecha de lunes a sábado.',
    });
  });

  it('uses a generic message when the error has no JSON body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(
      scheduleAppointment({ requestId: 'request-1', date: '2026-11-20' }),
    ).rejects.toThrow('No pudimos agendar la cita. Inténtelo de nuevo.');
  });
});
