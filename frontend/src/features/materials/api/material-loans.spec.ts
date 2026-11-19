import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deliverAppointmentMaterial,
  getMaterialHistory,
  returnMaterial,
} from './material-loans';
import { MaterialsApiError } from './search-materials';

const fetchMock = vi.fn();

describe('material-loans API client (HU-72)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'token-123');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('calls POST /appointments/:id/materials/:materialId/deliver with optional notes', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'loan-1', materialStatus: 'EN_USO' }),
    });

    const result = await deliverAppointmentMaterial({
      appointmentId: 'app-1',
      materialId: 'mat-1',
      notes: 'Con guantes',
    });

    expect(result.materialStatus).toBe('EN_USO');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/appointments/app-1/materials/mat-1/deliver');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ notes: 'Con guantes' });
  });

  it('calls POST /materials/:id/return and throws MaterialsApiError on failure', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: 'El material no está en uso.' }),
    });

    await expect(returnMaterial({ materialId: 'mat-1' })).rejects.toThrow(
      MaterialsApiError,
    );
  });

  it('calls GET /materials/:id/history with pagination params', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        material: {
          id: 'mat-1',
          catalogCode: 'TH-1',
          title: 'Acta 1',
          status: 'DISPONIBLE',
        },
        lastLoan: null,
        items: [],
        page: 2,
        limit: 5,
        total: 0,
      }),
    });

    const history = await getMaterialHistory({
      materialId: 'mat-1',
      page: 2,
      limit: 5,
    });

    expect(history.lastLoan).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/materials/mat-1/history?page=2&limit=5',
    );
  });
});
