import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAppointments } from './list-appointments';
import { RequestsApiError } from './list-requests';

const fetchMock = vi.fn();

describe('listAppointments', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('calls GET /api/v1/appointments with filters, sort and pagination', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], page: 2, limit: 20, total: 0 }),
    });

    const result = await listAppointments({
      status: 'PROGRAMADA',
      from: '2026-11-01',
      to: '2026-11-30',
      requester: 'juan',
      material: 'cabildo',
      sort: 'appointmentDate',
      order: 'asc',
      page: 2,
      limit: 20,
    });

    expect(result).toEqual({ items: [], page: 2, limit: 20, total: 0 });
    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost');
    expect(url.pathname).toBe('/api/v1/appointments');
    expect(url.searchParams.get('status')).toBe('PROGRAMADA');
    expect(url.searchParams.get('from')).toBe('2026-11-01');
    expect(url.searchParams.get('to')).toBe('2026-11-30');
    expect(url.searchParams.get('requester')).toBe('juan');
    expect(url.searchParams.get('material')).toBe('cabildo');
    expect(url.searchParams.get('sort')).toBe('appointmentDate');
    expect(url.searchParams.get('order')).toBe('asc');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('throws RequestsApiError with the server message when the request fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Solo PERSONAL o ADMIN pueden consultar las citas' }),
    });

    await expect(
      listAppointments({
        sort: 'appointmentDate',
        order: 'asc',
        page: 1,
        limit: 20,
      }),
    ).rejects.toEqual(
      new RequestsApiError('Solo PERSONAL o ADMIN pueden consultar las citas', 403),
    );
  });
});
