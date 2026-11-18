import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestApiError } from '../../requests/api/request-api-error';
import {
  createStaffUser,
  fullName,
  listStaffUsers,
  updateStaffUser,
} from './staff-users';

const fetchMock = vi.fn();

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

function lastCall(): { url: URL; init: RequestInit } {
  const [input, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return {
    url: new URL(input as string, 'http://localhost'),
    init: init as RequestInit,
  };
}

describe('staff users API (HU-05)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'token-admin');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('lists with the page, order and only the filters that are set', async () => {
    fetchMock.mockResolvedValue(ok({ items: [], page: 2, limit: 10, total: 0 }));

    await listStaffUsers({
      q: 'ana',
      role: 'ADMIN',
      active: false,
      sort: 'email',
      order: 'desc',
      page: 2,
      limit: 10,
    });

    const { url, init } = lastCall();
    expect(url.pathname).toBe('/api/v1/users/staff');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ana',
      role: 'ADMIN',
      active: 'false',
      sort: 'email',
      order: 'desc',
      page: '2',
      limit: '10',
    });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-admin' });

    await listStaffUsers({ sort: 'lastName', order: 'asc', page: 1, limit: 10 });
    expect([...lastCall().url.searchParams.keys()]).toEqual([
      'sort',
      'order',
      'page',
      'limit',
    ]);
  });

  it('creates an account with POST and edits one with PATCH', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'user-1' }));

    await createStaffUser({
      firstName: 'Laura',
      middleName: null,
      lastName: 'Gómez',
      secondLastName: null,
      email: 'laura@clena.org',
      password: 'inicial123',
    });
    expect(lastCall().url.pathname).toBe('/api/v1/users/staff');
    expect(lastCall().init.method).toBe('POST');

    await updateStaffUser('user 1', { active: false });
    expect(lastCall().url.pathname).toBe('/api/v1/users/staff/user%201');
    expect(lastCall().init).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
  });

  it('turns an error answer into a RequestApiError with its code', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        code: 'CANNOT_CHANGE_OWN_ACCESS',
        message: 'No puede desactivar su propia cuenta',
      }),
    });

    const error = await updateStaffUser('me', { active: false }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RequestApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'CANNOT_CHANGE_OWN_ACCESS',
    });
  });

  it('reports a network failure as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      listStaffUsers({ sort: 'lastName', order: 'asc', page: 1, limit: 10 }),
    ).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('joins the names that are present', () => {
    expect(
      fullName({
        firstName: 'Ana',
        middleName: null,
        lastName: 'Pérez',
        secondLastName: 'Gómez',
      }),
    ).toBe('Ana Pérez Gómez');
  });
});
