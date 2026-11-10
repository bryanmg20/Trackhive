import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from './authenticated-fetch';
import { readAccessToken, readRefreshToken } from '../session';

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

describe('authenticatedFetch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
  });

  it('renews an expired access token and retries the original request', async () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      token('PUBLICO', -60),
    );
    sessionStorage.setItem('trackhive.refreshToken', 'old-refresh');

    const renewedAccessToken = token('PUBLICO', 900);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Expired' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: renewedAccessToken,
          refreshToken: 'new-refresh',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));

    const response = await authenticatedFetch('/api/v1/materials', {
      headers: { Accept: 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1];
    expect(refreshUrl).toBe('/api/v1/auth/refresh');
    expect(refreshInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(refreshInit.body as string)).toEqual({
      refreshToken: 'old-refresh',
    });

    const [, retryInit] = fetchMock.mock.calls[2];
    expect(
      (retryInit.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${renewedAccessToken}`);

    expect(readAccessToken()).toBe(renewedAccessToken);
    expect(readRefreshToken()).toBe('new-refresh');
  });

  it('keeps the original 401 when there is no refresh token', async () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      token('PUBLICO', -60),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: 'Expired' }),
    );

    const response = await authenticatedFetch('/api/v1/materials');

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the original 401 and closes the session when refresh is rejected', async () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      token('PUBLICO', -60),
    );
    sessionStorage.setItem('trackhive.refreshToken', 'revoked-refresh');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Expired' }))
      .mockResolvedValueOnce(
        jsonResponse(401, { message: 'Invalid refresh token' }),
      );

    const response = await authenticatedFetch('/api/v1/materials');

    expect(response.status).toBe(401);
    expect(readAccessToken()).toBeNull();
    expect(readRefreshToken()).toBeNull();
  });
});
