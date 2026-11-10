import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logoutSession } from './logout-session';
import { readAccessToken, readRefreshToken, saveSession } from '../session';

const fetchMock = vi.fn();

describe('logoutSession', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
  });

  it('revokes the refresh token and clears the local session', async () => {
    saveSession({ accessToken: 'access', refreshToken: 'refresh' });
    fetchMock.mockResolvedValue({ status: 204 } as Response);

    await logoutSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/auth/logout');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(init.body as string)).toEqual({
      refreshToken: 'refresh',
    });
    expect(readAccessToken()).toBeNull();
    expect(readRefreshToken()).toBeNull();
  });

  it('closes the local session even when the backend cannot be reached', async () => {
    saveSession({ accessToken: 'access', refreshToken: 'refresh' });
    fetchMock.mockRejectedValue(new Error('offline'));

    await logoutSession();

    expect(readAccessToken()).toBeNull();
    expect(readRefreshToken()).toBeNull();
  });
});
