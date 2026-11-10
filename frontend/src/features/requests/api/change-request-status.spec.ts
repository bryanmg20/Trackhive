import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeRequestStatus } from './change-request-status';
import { RequestsApiError } from './list-requests';

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
  status: 'ATENDIDA',
  allowedTransitions: ['CERRADA'],
  statusChange: {
    previousStatus: 'AGENDADA',
    newStatus: 'ATENDIDA',
    changedAt: '2026-11-10T15:30:00.000Z',
    changedBy: { id: 'staff-1', name: 'Ana Gómez' },
    comment: 'Asistió',
  },
};

describe('changeRequestStatus', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'access-token');
  });

  it('sends PATCH /requests/:id/status with the status, the comment and the token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, RESULT));

    const result = await changeRequestStatus({
      requestId: 'request-1',
      status: 'ATENDIDA',
      comment: 'Asistió',
    });

    expect(result).toEqual(RESULT);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/requests/request-1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      status: 'ATENDIDA',
      comment: 'Asistió',
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-token',
    );
  });

  it('does not send the comment when there is none', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, RESULT));

    await changeRequestStatus({ requestId: 'request-1', status: 'CERRADA' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ status: 'CERRADA' });
  });

  it('throws the backend message and status on an invalid transition (409)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        code: 'INVALID_STATUS_TRANSITION',
        message: 'No se puede pasar una solicitud de Recibida a Atendida',
      }),
    );

    const error = await changeRequestStatus({
      requestId: 'request-1',
      status: 'ATENDIDA',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RequestsApiError);
    expect(error).toMatchObject({
      status: 409,
      message: 'No se puede pasar una solicitud de Recibida a Atendida',
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
      changeRequestStatus({ requestId: 'request-1', status: 'ATENDIDA' }),
    ).rejects.toThrow('No pudimos cambiar el estado. Inténtelo de nuevo.');
  });
});
