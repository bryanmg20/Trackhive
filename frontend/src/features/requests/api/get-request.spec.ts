import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequest } from './get-request';
import { readAccessToken, readRefreshToken } from '../../auth/session';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function token(role: string, expiresInSeconds: number): string {
  const payload = btoa(
    JSON.stringify({
      role,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
  );
  return `header.${payload}.signature`;
}

describe('getRequest', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
  });

  it('renews an expired access token and retries the request', async () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      token('PERSONAL', -60),
    );
    sessionStorage.setItem('trackhive.refreshToken', 'old-refresh');

    const renewedAccessToken = token('PERSONAL', 900);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Expired' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: renewedAccessToken,
          refreshToken: 'new-refresh',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { id: 'request-1', trackingCode: 'SOL-2026-1' }),
      );

    const request = await getRequest('request-1');

    expect(request).toMatchObject({ id: 'request-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/requests/request-1');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh');

    const [, retryInit] = fetchMock.mock.calls[2];
    expect(
      (retryInit.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${renewedAccessToken}`);
    expect(readAccessToken()).toBe(renewedAccessToken);
    expect(readRefreshToken()).toBe('new-refresh');
  });
});
