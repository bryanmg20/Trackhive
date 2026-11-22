import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReportCsv } from './export-report';

describe('getReportCsv', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  it('sends applied dates, ranking limit and the access token, and reads the server file name', async () => {
    sessionStorage.setItem('trackhive.accessToken', 'access-token');
    const blob = new Blob(['csv']);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ranking_top-20.csv"',
      }),
      blob: async () => blob,
    });
    expect(
      await getReportCsv('most-requested-materials', {
        from: '2026-11-01',
        to: '2026-11-30',
        limit: 20,
      }),
    ).toEqual({ blob, fileName: 'ranking_top-20.csv' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/reports/most-requested-materials/export?from=2026-11-01&to=2026-11-30&limit=20',
      { headers: { Accept: 'text/csv', Authorization: 'Bearer access-token' } },
    );
  });
  it('does not send ranking-only parameters for attention and uses a safe fallback file name', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="../../bad.csv"',
      }),
      blob: async () => new Blob(),
    });
    expect(
      (await getReportCsv('attention-times', { limit: 20 })).fileName,
    ).toBe('attention-times.csv');
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/reports/attention-times/export?',
    );
  });
  it('rejects HTML instead of downloading an Nginx fallback page', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/html' }),
    });
    await expect(getReportCsv('attention-times', {})).rejects.toMatchObject({
      code: 'INVALID_CSV_RESPONSE',
    });
  });
  it('preserves a 403 and handles network failure', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: 'FORBIDDEN', message: 'Forbidden' }),
    });
    await expect(getReportCsv('attention-times', {})).rejects.toMatchObject({
      status: 403,
    });
    fetchMock.mockRejectedValueOnce(new TypeError('Offline'));
    await expect(getReportCsv('attention-times', {})).rejects.toMatchObject({
      status: 0,
    });
  });
});
