import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestApiError } from '../../requests/api/request-api-error';
import { getSyncStatus, requestSync } from './everything-sync';

const fetchMock = vi.fn();

const answer = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function lastCall(): { url: URL; init: RequestInit } {
  const [input, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return {
    url: new URL(input as string, 'http://localhost'),
    init: init as RequestInit,
  };
}

describe('Everything sync API (HU-138)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'token-admin');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('reads the state of the sync with the session of the administrator', async () => {
    const status = {
      enabled: true,
      currentRun: null,
      lastRun: null,
      agentLastContactAt: null,
    };
    fetchMock.mockResolvedValue(answer(200, status));

    expect(await getSyncStatus()).toEqual(status);

    const { url, init } = lastCall();
    expect(url.pathname).toBe('/api/v1/everything/sync-status');
    expect(init.method).toBeUndefined();
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-admin' });
  });

  it('asks for «Sincronizar ahora» with a POST and gets the run PEDIDA', async () => {
    const run = { id: 'run-1', status: 'PEDIDA' };
    fetchMock.mockResolvedValue(answer(201, run));

    expect(await requestSync()).toEqual(run);

    const { url, init } = lastCall();
    expect(url.pathname).toBe('/api/v1/everything/sync-requests');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('turns a 409 into an error with its code and message', async () => {
    fetchMock.mockResolvedValue(
      answer(409, {
        statusCode: 409,
        code: 'SYNC_RUN_ALREADY_REQUESTED',
        message: 'Ya hay una sincronización pedida',
      }),
    );

    const error = await requestSync().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RequestApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'SYNC_RUN_ALREADY_REQUESTED',
      message: 'Ya hay una sincronización pedida',
    });
  });

  it('turns a network failure into a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getSyncStatus()).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});
