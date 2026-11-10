import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRoute } from '../auth/components/StaffRoute';
import { RequestsListPage } from './RequestsListPage';

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
    status: 'RECIBIDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-01',
    registeredAt: '2026-11-10T15:00:00.000Z',
    requesterName: 'Juan Carlos Pérez',
    requesterEmail: 'juan@mail.com',
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
    <MemoryRouter initialEntries={['/solicitudes']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/solicitudes" element={<RequestsListPage />} />
        </Route>
        <Route path="/materiales" element={<p>Pantalla de búsqueda</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequestsListPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'lists the requests with requester, material, date and status for %s',
    async (role) => {
      fetchMock.mockResolvedValue(page([item()]));
      renderPage(role);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('SOL-2026-00001')).toBeInTheDocument();
      expect(within(table).getByText('Juan Carlos Pérez')).toBeInTheDocument();
      expect(within(table).getByText('Acta de fundación')).toBeInTheDocument();
      expect(within(table).getByText('01/12/2026')).toBeInTheDocument();
      expect(within(table).getByText('Recibida')).toBeInTheDocument();
      expect(screen.getByText('1 solicitudes')).toBeInTheDocument();
    },
  );

  it('asks for the newest requests first, 10 per page', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    const url = lastUrl();
    expect(url.pathname).toBe('/api/v1/requests');
    expect(url.searchParams.get('sort')).toBe('registeredAt');
    expect(url.searchParams.get('order')).toBe('desc');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('sends a PUBLICO user to the public search and loads nothing', () => {
    renderPage('PUBLICO');

    expect(screen.getByText('Pantalla de búsqueda')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a visitor without a session to the login', () => {
    renderPage();

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'Agendada' }));

    await waitFor(() => {
      expect(lastUrl().searchParams.get('status')).toBe('AGENDADA');
      expect(lastUrl().searchParams.get('page')).toBe('1');
    });
  });

  it('filters by requester, material and desired date range', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    await user.type(screen.getByLabelText('Material'), 'cabildo');
    await user.type(screen.getByLabelText('Fecha deseada desde'), '2026-12-01');
    await user.type(screen.getByLabelText('Fecha deseada hasta'), '2026-12-31');
    await user.type(screen.getByLabelText('Solicitante'), 'juan pérez{Enter}');

    await waitFor(() => {
      const { searchParams } = lastUrl();
      expect(searchParams.get('requester')).toBe('juan pérez');
      expect(searchParams.get('material')).toBe('cabildo');
      expect(searchParams.get('desiredFrom')).toBe('2026-12-01');
      expect(searchParams.get('desiredTo')).toBe('2026-12-31');
    });
  });

  it('sorts by desired date, oldest first', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
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
    renderPage('PERSONAL');
    await screen.findByText('Página 1 de 3');

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => expect(lastUrl().searchParams.get('page')).toBe('2'));
  });

  it('shows an empty message when nothing matches', async () => {
    fetchMock.mockResolvedValue(page([]));
    renderPage('PERSONAL');

    expect(
      await screen.findByText('No encontramos solicitudes con esos filtros.'),
    ).toBeInTheDocument();
  });

  it('shows the API error and a login link on 401', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });
    renderPage('PERSONAL');

    expect(
      await screen.findByText('Su sesión no es válida o venció.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('links to the material screen of the staff', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    expect(screen.getByRole('link', { name: 'Material' })).toHaveAttribute(
      'href',
      '/personal/materiales',
    );
  });

  it('applies a desired date as soon as it is chosen, without pressing Buscar', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    await user.type(screen.getByLabelText('Fecha deseada desde'), '2026-12-05');

    await waitFor(() =>
      expect(lastUrl().searchParams.get('desiredFrom')).toBe('2026-12-05'),
    );
  });

  it('removes the date filter when the date is cleared', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    const from = screen.getByLabelText('Fecha deseada desde');
    await user.type(from, '2026-12-05');
    await waitFor(() =>
      expect(lastUrl().searchParams.get('desiredFrom')).toBe('2026-12-05'),
    );
    await user.clear(from);

    await waitFor(() =>
      expect(lastUrl().searchParams.has('desiredFrom')).toBe(false),
    );
  });

  it('shows «Quitar filtros» only when a filter is set', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    expect(
      screen.queryByRole('button', { name: 'Quitar filtros' }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Fecha deseada desde'), '2026-12-05');

    expect(
      await screen.findByRole('button', { name: 'Quitar filtros' }),
    ).toBeInTheDocument();
  });

  it('removes every filter and keeps the order when «Quitar filtros» is pressed', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    await user.selectOptions(
      screen.getByLabelText('Ordenar por'),
      'desiredDate',
    );
    await user.click(screen.getByRole('radio', { name: 'Agendada' }));
    await user.type(screen.getByLabelText('Fecha deseada desde'), '2026-12-05');
    await user.type(screen.getByLabelText('Fecha deseada hasta'), '2026-12-31');
    await user.type(screen.getByLabelText('Material'), 'cabildo');
    await user.type(screen.getByLabelText('Solicitante'), 'juan{Enter}');
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));

    await waitFor(() => {
      const { searchParams } = lastUrl();
      expect(searchParams.has('status')).toBe(false);
      expect(searchParams.has('desiredFrom')).toBe(false);
      expect(searchParams.has('desiredTo')).toBe(false);
      expect(searchParams.has('requester')).toBe(false);
      expect(searchParams.has('material')).toBe(false);
      expect(searchParams.get('sort')).toBe('desiredDate');
    });
    expect(screen.getByLabelText('Fecha deseada desde')).toHaveValue('');
    expect(screen.getByLabelText('Material')).toHaveValue('');
    expect(screen.getByLabelText('Solicitante')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Todos' })).toBeChecked();
    expect(
      screen.queryByRole('button', { name: 'Quitar filtros' }),
    ).not.toBeInTheDocument();
  });

  it('links to the screen to register a visitor request', async () => {
    fetchMock.mockResolvedValue(page([item()]));
    renderPage('PERSONAL');
    await screen.findByRole('table');

    expect(
      screen.getByRole('link', { name: /registrar solicitud de visitante/i }),
    ).toHaveAttribute('href', '/personal/solicitudes/nueva');
  });
});
