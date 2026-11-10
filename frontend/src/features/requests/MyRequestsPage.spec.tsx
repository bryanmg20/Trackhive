import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../auth/components/ProtectedRoute';
import { MyRequestsPage } from './MyRequestsPage';

const fetchMock = vi.fn();

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    trackingCode: 'SOL-2026-00001',
    status: 'EN_BUSQUEDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-01',
    registeredAt: '2026-11-10T15:00:00.000Z',
    rejectionReason: null,
    materials: [
      {
        id: 'material-1',
        catalogCode: 'TH-DOC-0001',
        title: 'Acta de fundación',
      },
    ],
    ...overrides,
  };
}

function page(items: unknown[], total = items.length, pageNumber = 1) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, page: pageNumber, limit: 10, total }),
  };
}

function lastUrl(): URL {
  const calls = fetchMock.mock.calls;
  return new URL(calls[calls.length - 1][0] as string, 'http://localhost');
}

function renderPage(role?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }
  return render(
    <MemoryRouter initialEntries={['/mis-solicitudes']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/mis-solicitudes" element={<MyRequestsPage />} />
        </Route>
        <Route path="/materiales" element={<p>Pantalla de búsqueda</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MyRequestsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the tracking code, registration date and status of each request', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PUBLICO');

    const table = await screen.findByRole('table');
    expect(
      within(table).getByRole('columnheader', { name: 'Código de seguimiento' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: 'Fecha de radicación' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: 'Estado' }),
    ).toBeInTheDocument();
    expect(within(table).getByText('SOL-2026-00001')).toBeInTheDocument();
    expect(within(table).getByText('10/11/2026')).toBeInTheDocument();
    expect(within(table).getByText('En búsqueda')).toBeInTheDocument();
    expect(within(table).getByText('Acta de fundación')).toBeInTheDocument();
    expect(within(table).getByText('01/12/2026')).toBeInTheDocument();
    expect(screen.getByText('1 solicitud')).toBeInTheDocument();
  });

  it('shows the reason of a rejected request to its requester (HU-16)', async () => {
    fetchMock.mockResolvedValue(
      page([
        item({
          id: 'rejected',
          trackingCode: 'SOL-2026-00002',
          status: 'RECHAZADA',
          rejectionReason: 'El material está restringido por la familia donante',
        }),
        item(),
      ]),
    );
    renderPage('PUBLICO');

    const table = await screen.findByRole('table');
    const [, rejectedRow, otherRow] = within(table).getAllByRole('row');
    expect(rejectedRow).toHaveTextContent('Rechazada');
    expect(rejectedRow).toHaveTextContent(
      'Motivo del rechazo: El material está restringido por la familia donante',
    );
    expect(otherRow).not.toHaveTextContent('Motivo del rechazo');
  });

  it('shows the registration day in Bogotá, not in UTC', async () => {
    // 01:30 UTC on the 11th is 8:30 p.m. on the 10th in Bogotá
    fetchMock.mockResolvedValue(
      page([item({ registeredAt: '2026-11-11T01:30:00.000Z' })]),
    );
    renderPage('PUBLICO');

    const table = await screen.findByRole('table');
    expect(within(table).getByText('10/11/2026')).toBeInTheDocument();
    expect(within(table).queryByText('11/11/2026')).not.toBeInTheDocument();
  });

  it('asks for my requests only, newest first, 10 per page', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    const url = lastUrl();
    expect(url.pathname).toBe('/api/v1/requests/mine');
    expect(url.searchParams.get('sort')).toBe('registeredAt');
    expect(url.searchParams.get('order')).toBe('desc');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.has('status')).toBe(false);
  });

  it('sends the access token', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers.Authorization).toBe(
      `Bearer ${sessionStorage.getItem('trackhive.accessToken')}`,
    );
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'sends a %s user to the login and loads nothing',
    (role) => {
      renderPage(role);

      expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('sends a visitor without a session to the login', () => {
    renderPage();

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filters by status and goes back to the first page', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()], 25));
    renderPage('PUBLICO');
    await screen.findByText('Página 1 de 3');
    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(lastUrl().searchParams.get('page')).toBe('2'));

    await user.click(screen.getByRole('radio', { name: 'Agendada' }));

    await waitFor(() => {
      expect(lastUrl().searchParams.get('status')).toBe('AGENDADA');
      expect(lastUrl().searchParams.get('page')).toBe('1');
    });
  });

  it('removes the status filter with «Todos»', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'Rechazada' }));
    await waitFor(() =>
      expect(lastUrl().searchParams.get('status')).toBe('RECHAZADA'),
    );
    await user.click(screen.getByRole('radio', { name: 'Todos' }));

    await waitFor(() =>
      expect(lastUrl().searchParams.has('status')).toBe(false),
    );
  });

  it('offers a status option for every request status', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    const statusGroup = screen.getByRole('group', { name: 'Estado' });
    expect(
      within(statusGroup)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual([
      'Todos',
      'Recibida',
      'En búsqueda',
      'Disponible',
      'Agendada',
      'Atendida',
      'Cerrada',
      'Rechazada',
    ]);
  });

  it('sorts by desired date, oldest first', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    await user.selectOptions(
      screen.getByLabelText('Ordenar por'),
      'desiredDate',
    );
    await user.selectOptions(screen.getByLabelText('Dirección'), 'asc');

    await waitFor(() => {
      expect(lastUrl().searchParams.get('sort')).toBe('desiredDate');
      expect(lastUrl().searchParams.get('order')).toBe('asc');
    });
  });

  it('moves through the pages', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()], 25));
    renderPage('PUBLICO');
    await screen.findByText('Página 1 de 3');

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => expect(lastUrl().searchParams.get('page')).toBe('2'));
  });

  it('invites to search material when there are no requests yet', async () => {
    fetchMock.mockResolvedValue(page([]));
    renderPage('PUBLICO');

    expect(
      await screen.findByText('Aún no ha radicado solicitudes.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al buscador' })).toHaveAttribute(
      'href',
      '/materiales',
    );
  });

  it('says which status has no requests when filtering', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(page([item()]));
    fetchMock.mockResolvedValue(page([]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'Agendada' }));

    expect(
      await screen.findByText('No tiene solicitudes en estado «Agendada».'),
    ).toBeInTheDocument();
  });

  it('shows a login link when the session is not valid', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });
    renderPage('PUBLICO');

    expect(
      await screen.findByText('Su sesión no es válida o venció.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('shows a connection message when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage('PUBLICO');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor',
    );
  });

  it('links to the material search', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(
      within(nav).getByRole('link', { name: 'Buscar material' }),
    ).toHaveAttribute('href', '/materiales');
    expect(
      within(nav).getByRole('link', { name: 'Mis solicitudes' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});
