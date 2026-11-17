import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestHistory } from './get-request-history';
import { RequestsApiError } from './list-requests';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const ACCESS_TOKEN = `header.${btoa(
  JSON.stringify({ role: 'PUBLICO', exp: Math.floor(Date.now() / 1000) + 900 }),
)}.signature`;

describe('getRequestHistory', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', ACCESS_TOKEN);
  });

  it('asks the history of the request with the access token', async () => {
    const history = { requestId: 'request-1', trackingCode: 'SOL-1', entries: [] };
    fetchMock.mockResolvedValue(jsonResponse(200, history));

    await expect(getRequestHistory('request-1')).resolves.toEqual(history);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/requests/request-1/history');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
  });

  it('throws the message and status of the backend', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { message: 'No tiene permiso para ver esta solicitud.' }),
    );

    const error = await getRequestHistory('request-1').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RequestsApiError);
    expect(error).toMatchObject({
      status: 403,
      message: 'No tiene permiso para ver esta solicitud.',
    });
  });
});
