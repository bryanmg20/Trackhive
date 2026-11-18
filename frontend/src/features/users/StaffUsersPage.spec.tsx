import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRoute } from '../auth/components/AdminRoute';
import { StaffUsersPage } from './StaffUsersPage';

const fetchMock = vi.fn();

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function staff(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    firstName: 'Laura',
    middleName: null,
    lastName: 'Gómez',
    secondLastName: null,
    email: 'laura@clena.org',
    role: 'PERSONAL',
    active: true,
    ...overrides,
  };
}

function page(items: unknown[], total = items.length) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, page: 1, limit: 10, total }),
  };
}

function answer(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

interface Call {
  url: URL;
  method: string;
  body: unknown;
}

function calls(): Call[] {
  return fetchMock.mock.calls.map(([input, init]) => {
    const options = (init ?? {}) as RequestInit;
    return {
      url: new URL(input as string, 'http://localhost'),
      method: options.method ?? 'GET',
      body: options.body ? JSON.parse(options.body as string) : undefined,
    };
  });
}

const lastList = () =>
  calls()
    .filter((call) => call.method === 'GET')
    .at(-1)!.url;

function renderPage(role?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }
  return render(
    <MemoryRouter initialEntries={['/admin/usuarios']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/usuarios" element={<StaffUsersPage />} />
        </Route>
        <Route path="/solicitudes" element={<p>Bandeja del personal</p>} />
        <Route path="/materiales" element={<p>Pantalla de búsqueda</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StaffUsersPage (HU-05)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('lists the staff accounts with their role and status', async () => {
    fetchMock.mockResolvedValue(
      page([
        staff(),
        staff({
          id: 'u2',
          firstName: 'Mario',
          lastName: 'Acosta',
          email: 'mario@clena.org',
          role: 'ADMIN',
          active: false,
        }),
      ]),
    );
    renderPage('ADMIN');

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Laura Gómez')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Personal')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Activa')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Administrador')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Desactivada')).toBeInTheDocument();
    expect(
      within(rows[2]).getByRole('button', {
        name: 'Activar la cuenta de Mario Acosta',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 cuentas' })).toBeInTheDocument();

    expect(Object.fromEntries(lastList().searchParams)).toEqual({
      sort: 'lastName',
      order: 'asc',
      page: '1',
      limit: '10',
    });
  });

  it('searches, filters, orders and changes page through the API', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([staff()], 25));
    renderPage('ADMIN');
    await screen.findByRole('table');

    await user.type(screen.getByLabelText('Buscar por nombre o correo'), ' ana ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(lastList().searchParams.get('q')).toBe('ana'));

    await user.click(screen.getByRole('radio', { name: 'Administrador' }));
    await waitFor(() =>
      expect(lastList().searchParams.get('role')).toBe('ADMIN'),
    );

    await user.click(screen.getByRole('radio', { name: 'Desactivadas' }));
    await waitFor(() =>
      expect(lastList().searchParams.get('active')).toBe('false'),
    );

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'email');
    await user.selectOptions(screen.getByLabelText('Dirección'), 'desc');
    await waitFor(() =>
      expect(Object.fromEntries(lastList().searchParams)).toMatchObject({
        sort: 'email',
        order: 'desc',
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Siguiente ›' }));
    await waitFor(() => expect(lastList().searchParams.get('page')).toBe('2'));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() =>
      expect(Object.fromEntries(lastList().searchParams)).toEqual({
        sort: 'email',
        order: 'desc',
        page: '1',
        limit: '10',
      }),
    );
  });

  it('creates a PERSONAL account with its initial password and reloads the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_input: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'POST'
          ? answer(staff({ firstName: 'Ana', lastName: 'Pérez' }), 201)
          : page([staff()]),
      ),
    );
    renderPage('ADMIN');
    await screen.findByRole('table');

    await user.click(
      screen.getByRole('button', { name: 'Crear cuenta del personal' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Crear cuenta del personal' }),
    ).toHaveFocus();
    // There is no role to choose: new accounts are always PERSONAL
    expect(screen.queryByRole('combobox', { name: 'Rol' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Las cuentas nuevas siempre se crean con rol Personal.'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Primer nombre'), ' Ana ');
    await user.type(screen.getByLabelText('Primer apellido'), 'Pérez');
    await user.type(screen.getByLabelText('Correo'), 'ana@clena.org');
    await user.type(screen.getByLabelText('Contraseña inicial'), 'inicial123');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText(
        'Se creó la cuenta de Ana Pérez. Ya puede iniciar sesión con la contraseña inicial.',
      ),
    ).toBeInTheDocument();
    const post = calls().find((call) => call.method === 'POST');
    expect(post?.url.pathname).toBe('/api/v1/users/staff');
    expect(post?.body).toEqual({
      firstName: 'Ana',
      middleName: null,
      lastName: 'Pérez',
      secondLastName: null,
      email: 'ana@clena.org',
      password: 'inicial123',
    });
    // The list is asked again so the new account shows up
    expect(calls().filter((call) => call.method === 'GET')).toHaveLength(2);
  });

  it('shows the field errors that the API returns', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_input: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'POST'
          ? answer(
              {
                code: 'VALIDATION_ERROR',
                message: 'La petición contiene datos inválidos',
                details: [
                  {
                    field: 'password',
                    messages: ['La contraseña debe tener al menos 8 caracteres'],
                  },
                ],
              },
              400,
            )
          : page([staff()]),
      ),
    );
    renderPage('ADMIN');
    await screen.findByRole('table');

    await user.click(
      screen.getByRole('button', { name: 'Crear cuenta del personal' }),
    );
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('La contraseña debe tener al menos 8 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña inicial')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Revise los campos marcados.',
    );
  });

  it('edits the names and email, never the role', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_input: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'PATCH'
          ? answer(staff({ firstName: 'Lucía' }))
          : page([staff()]),
      ),
    );
    renderPage('ADMIN');

    await user.click(
      await screen.findByRole('button', {
        name: 'Editar la cuenta de Laura Gómez',
      }),
    );
    expect(screen.getByLabelText('Primer nombre')).toHaveValue('Laura');
    expect(screen.queryByLabelText('Contraseña inicial')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Rol' })).not.toBeInTheDocument();
    expect(screen.getByText('El rol no se puede cambiar.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Primer nombre'));
    await user.type(screen.getByLabelText('Primer nombre'), 'Lucía');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText('Se guardaron los cambios de Lucía Gómez.'),
    ).toBeInTheDocument();
    const patch = calls().find((call) => call.method === 'PATCH');
    expect(patch?.url.pathname).toBe(
      '/api/v1/users/staff/00000000-0000-4000-8000-000000000001',
    );
    expect(patch?.body).toEqual({
      firstName: 'Lucía',
      middleName: null,
      lastName: 'Gómez',
      secondLastName: null,
      email: 'laura@clena.org',
    });
  });

  it('asks for confirmation before deactivating and then sends active=false', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_input: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'PATCH'
          ? answer(staff({ active: false }))
          : page([staff()]),
      ),
    );
    renderPage('ADMIN');

    await user.click(
      await screen.findByRole('button', {
        name: 'Desactivar la cuenta de Laura Gómez',
      }),
    );
    expect(
      screen.getByRole('heading', {
        name: '¿Desactivar la cuenta de Laura Gómez?',
      }),
    ).toHaveFocus();
    expect(calls().some((call) => call.method === 'PATCH')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Desactivar cuenta' }));

    expect(
      await screen.findByText('Se desactivó la cuenta de Laura Gómez.'),
    ).toBeInTheDocument();
    expect(calls().find((call) => call.method === 'PATCH')?.body).toEqual({
      active: false,
    });
  });

  it('shows why the API refuses a deactivation', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_input: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'PATCH'
          ? answer(
              {
                code: 'CANNOT_CHANGE_OWN_ACCESS',
                message: 'No puede desactivar su propia cuenta',
              },
              409,
            )
          : page([staff({ role: 'ADMIN' })]),
      ),
    );
    renderPage('ADMIN');

    await user.click(
      await screen.findByRole('button', {
        name: 'Desactivar la cuenta de Laura Gómez',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Desactivar cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No puede desactivar su propia cuenta',
    );
  });

  it('reactivates a deactivated account right away', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_input: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'PATCH'
          ? answer(staff({ active: true }))
          : page([staff({ active: false })]),
      ),
    );
    renderPage('ADMIN');

    await user.click(
      await screen.findByRole('button', {
        name: 'Activar la cuenta de Laura Gómez',
      }),
    );

    expect(
      await screen.findByText('Se activó la cuenta de Laura Gómez.'),
    ).toBeInTheDocument();
    expect(calls().find((call) => call.method === 'PATCH')?.body).toEqual({
      active: true,
    });
  });

  it('explains a 403 from the API', async () => {
    fetchMock.mockResolvedValue(
      answer({ code: 'FORBIDDEN', message: 'No tienes permiso' }, 403),
    );
    renderPage('ADMIN');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo un administrador puede gestionar las cuentas del personal.',
    );
  });

  it.each([
    ['PERSONAL', 'Bandeja del personal'],
    ['PUBLICO', 'Pantalla de búsqueda'],
  ])('does not open for %s and loads nothing', (role, destination) => {
    renderPage(role);

    expect(screen.getByText(destination)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
