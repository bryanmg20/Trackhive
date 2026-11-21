import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration, getAttentionTimes } from './attention-times';

describe('attention times API and duration presentation', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  it('calls the versioned endpoint with the date filters', async () => {
    const data = { completedRequests: 2, averageSeconds: 0, states: [] };
    fetchMock.mockResolvedValue({ ok: true, json: async () => data });
    expect(
      await getAttentionTimes({ from: '2026-11-01', to: '2026-11-30' }),
    ).toEqual(data);
    const url = new URL(
      fetchMock.mock.calls[0][0] as string,
      'http://localhost',
    );
    expect(url.pathname).toBe('/api/v1/reports/attention-times');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });
  it('preserves backend errors and translates network failure', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: 'FORBIDDEN', message: 'Solo ADMIN' }),
    });
    await expect(getAttentionTimes({})).rejects.toMatchObject({
      status: 403,
      message: 'Solo ADMIN',
    });
    fetchMock.mockRejectedValueOnce(new TypeError('Network error'));
    await expect(getAttentionTimes({})).rejects.toMatchObject({ status: 0 });
  });
  it.each([
    [null, 'Sin datos'],
    [0, '0 s'],
    [0.001, 'Menos de 0,01 s'],
    [45, '45 s'],
    [90, '1,5 min'],
    [5400, '1,5 h'],
    [86400, '1 día'],
    [129600, '1,5 días'],
  ] as const)('formats %s seconds as %s', (seconds, label) => {
    expect(formatDuration(seconds)).toBe(label);
  });
});
