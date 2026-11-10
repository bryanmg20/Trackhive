import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listMyRequests } from './list-my-requests';
import { readAccessToken, readRefreshToken } from '../../auth/session';

const fetchMock = vi.fn();
const PARAMS = {
  sort: 'registeredAt',
  order: 'desc',
  page: 1,
  limit: 10,
} as const;

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

describe('listMyRequests', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
  });

  it('renews an expired access token and retries the request', async () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      token('PUBLICO', -60),
    );
    sessionStorage.setItem('trackhive.refreshToken', 'old-refresh');

    const renewedAccessToken = token('PUBLICO', 900);
    const url =
      '/api/v1/requests/mine?sort=registeredAt&order=desc&page=1&limit=10';
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Expired' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: renewedAccessToken,
          refreshToken: 'new-refresh',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [], page: 1, limit: 10, total: 0 }),
      );

    const page = await listMyRequests(PARAMS);

    expect(page).toMatchObject({ items: [], total: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[2][0]).toBe(url);

    const [, retryInit] = fetchMock.mock.calls[2];
    expect(
      (retryInit.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${renewedAccessToken}`);
    expect(readAccessToken()).toBe(renewedAccessToken);
    expect(readRefreshToken()).toBe('new-refresh');
  });
});
