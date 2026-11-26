import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRoute } from '../auth/components/StaffRoute';
import { MostRequestedMaterialsPage } from './MostRequestedMaterialsPage';

const fetchMock = vi.fn();
const PATH = '/reportes/material-mas-solicitado';

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function item(rank: number, title: string, requestCount: number) {
  return {
    rank,
    materialId: `m-${title}`,
    catalogCode: `CLENA-${rank}`,
    title,
    materialType: 'DOCUMENTO',
    requestCount,
  };
}

function answer(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

function ranking(items: unknown[], extra: Record<string, unknown> = {}) {
  return answer({
    from: null,
    to: null,
    totalRequests: 7,
    items,
    ...extra,
  });
}

const lastQuery = () => {
  const [input] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return Object.fromEntries(new URL(input as string, 'http://localhost').searchParams);
};

function renderPage(role = 'PERSONAL') {
  sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  return render(
    <MemoryRouter initialEntries={[PATH]}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path={PATH} element={<MostRequestedMaterialsPage />} />
        </Route>
        <Route path="/materiales" element={<p>Pantalla de búsqueda</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MostRequestedMaterialsPage (HU-26)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the ranking with bars scaled to the most requested material', async () => {
    fetchMock.mockResolvedValue(
      ranking([
        item(1, 'Actas del Concejo', 4),
        item(2, 'Bando de la Gobernación', 2),
        item(2, 'Diario del Comercio', 2),
        item(4, 'Censo de 1912', 1),
      ]),
    );
    renderPage();

    const main = await screen.findByRole('main');
    const list = await within(main).findByRole('list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Puesto 1');
    expect(rows[0]).toHaveTextContent('Actas del Concejo');
    expect(rows[0]).toHaveTextContent('4 solicitudes');
    expect(rows[2]).toHaveTextContent('Puesto 2');
    expect(rows[3]).toHaveTextContent('1 solicitud');
    expect(rows[3]).toHaveTextContent('CLENA-4 · Documento');

    const widths = screen
      .getAllByTestId('ranking-bar')
      .map((bar) => bar.style.width);
    expect(widths).toEqual(['100%', '50%', '50%', '25%']);

    expect(
      screen.getByText('7 solicitudes registradas en todo el historial.'),
    ).toBeInTheDocument();
    expect(lastQuery()).toEqual({ limit: '10' });
  });

  it('filters by the date range and changes the size of the ranking', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(ranking([item(1, 'Actas del Concejo', 1)]));
    renderPage('ADMIN');
    await screen.findByRole('list');

    fetchMock.mockResolvedValue(
      ranking([item(1, 'Actas del Concejo', 1)], {
        from: '2026-11-01',
        to: '2026-11-30',
        totalRequests: 1,
      }),
    );
    await user.type(screen.getByLabelText('Registradas desde'), '2026-11-01');
    await user.type(screen.getByLabelText('Registradas hasta'), '2026-11-30');
    await user.click(screen.getByRole('button', { name: 'Aplicar fechas' }));

    expect(
      await screen.findByText(
        '1 solicitud registrada del 1 de noviembre de 2026 al 30 de noviembre de 2026.',
      ),
    ).toBeInTheDocument();
    expect(lastQuery()).toEqual({
      limit: '10',
      from: '2026-11-01',
      to: '2026-11-30',
    });

    await user.selectOptions(screen.getByLabelText('Mostrar'), '50');
    await waitFor(() =>
      expect(lastQuery()).toEqual({
        limit: '50',
        from: '2026-11-01',
        to: '2026-11-30',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Quitar fechas' }));
    await waitFor(() => expect(lastQuery()).toEqual({ limit: '50' }));
    expect(screen.getByLabelText('Registradas desde')).toHaveValue('');
  });

  it('does not ask the server for a start after the end', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(ranking([]));
    renderPage();
    await screen.findByText('No hay solicitudes en este periodo');
    const callsBefore = fetchMock.mock.calls.length;

    await user.type(screen.getByLabelText('Registradas desde'), '2026-12-01');
    await user.type(screen.getByLabelText('Registradas hasta'), '2026-11-01');
    await user.click(screen.getByRole('button', { name: 'Aplicar fechas' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La fecha inicial no puede ser posterior a la fecha final.',
    );
    expect(screen.getByLabelText('Registradas desde')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('shows an empty state when the period has no requests', async () => {
    fetchMock.mockResolvedValue(ranking([], { totalRequests: 0 }));
    renderPage();

    expect(
      await screen.findByText('No hay solicitudes en este periodo'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).queryByRole('list'),
    ).not.toBeInTheDocument();
  });

  it('explains a 403 in the words of the screen', async () => {
    fetchMock.mockResolvedValue(
      answer({ code: 'FORBIDDEN', message: 'Forbidden resource' }, 403),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo el personal del CLENA puede consultar los reportes.',
    );
  });

  it('sends a public user away from the report', () => {
    renderPage('PUBLICO');
    expect(screen.getByText('Pantalla de búsqueda')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
