import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestApiError } from '../../requests/api/request-api-error';
import { barWidth, getMostRequestedMaterials } from './most-requested-materials';

const fetchMock = vi.fn();

function lastUrl(): URL {
  const [input] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return new URL(input as string, 'http://localhost');
}

describe('most requested materials API (HU-26)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'token-staff');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends the limit and only the dates that are set', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ from: null, to: null, totalRequests: 0, items: [] }),
    });

    await getMostRequestedMaterials({
      from: '2026-11-01',
      to: '2026-11-30',
      limit: 20,
    });
    expect(lastUrl().pathname).toBe('/api/v1/reports/most-requested-materials');
    expect(Object.fromEntries(lastUrl().searchParams)).toEqual({
      limit: '20',
      from: '2026-11-01',
      to: '2026-11-30',
    });

    await getMostRequestedMaterials({ limit: 10 });
    expect(Object.fromEntries(lastUrl().searchParams)).toEqual({ limit: '10' });
  });

  it('turns an error answer into a RequestApiError with its code', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        code: 'INVALID_REPORT_PERIOD',
        message: 'La fecha inicial no puede ser posterior a la fecha final.',
      }),
    });

    const error = await getMostRequestedMaterials({ limit: 10 }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(RequestApiError);
    expect(error).toMatchObject({ status: 400, code: 'INVALID_REPORT_PERIOD' });
  });

  it('reports a network failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getMostRequestedMaterials({ limit: 10 })).rejects.toMatchObject(
      { status: 0, code: 'NETWORK_ERROR' },
    );
  });
});

describe('barWidth', () => {
  it('scales every count to the largest one', () => {
    expect(barWidth(40, 40)).toBe('100%');
    expect(barWidth(1, 3)).toBe('33.3%');
    expect(barWidth(1, 3000)).toBe('0%');
  });

  it('never divides by zero', () => {
    expect(barWidth(0, 0)).toBe('0%');
  });
});
