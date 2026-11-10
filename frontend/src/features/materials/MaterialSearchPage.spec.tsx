import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialSearchPage } from './MaterialSearchPage';

const fetchMock = vi.fn();

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function material(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    catalogCode: `TH-DOC-000${index}`,
    title: `Acta ${index}`,
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Actas del Cabildo',
    publicationDate: null,
    publisher: null,
    status: 'DISPONIBLE',
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

function RequestDestination() {
  const location = useLocation();
  return <p>Destino: {location.pathname + location.search}</p>;
}

function renderPage(role: string) {
  sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  return render(
    <MemoryRouter initialEntries={['/materiales']}>
      <Routes>
        <Route path="/materiales" element={<MaterialSearchPage />} />
        <Route path="/solicitudes/nueva" element={<RequestDestination />} />
        <Route
          path="/personal/materiales"
          element={<p>Pantalla de material del personal</p>}
        />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MaterialSearchPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows title, type and availability of each result', async () => {
    fetchMock.mockResolvedValue(
      page([
        material(1),
        material(2, { materialType: 'PERIODICO', status: 'EN_RESTAURACION' }),
      ]),
    );
    renderPage('PUBLICO');

    await screen.findByText('Acta 1');
    // First row is the table header
    const items = screen.getAllByRole('row').slice(1);
    expect(within(items[0]).getByText('Acta 1')).toBeInTheDocument();
    expect(within(items[0]).getByText('Documento')).toBeInTheDocument();
    expect(within(items[0]).getByText('Disponible')).toBeInTheDocument();
    expect(within(items[1]).getByText('Periódico')).toBeInTheDocument();
    expect(within(items[1]).getByText('En restauración')).toBeInTheDocument();
  });

  it('sends the text, type and collection filters to the endpoint', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([material(1)]));
    renderPage('PUBLICO');
    await screen.findByText('Acta 1');

    await user.type(screen.getByLabelText('Buscar'), 'cabildo');
    await user.click(screen.getByRole('radio', { name: 'Periódico' }));
    await user.type(screen.getByLabelText('Colección o tema'), 'Prensa');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await screen.findByText('Acta 1');
    const url = lastUrl();
    expect(url.pathname).toBe('/api/v1/materials');
    expect(url.searchParams.get('q')).toBe('cabildo');
    expect(url.searchParams.get('type')).toBe('PERIODICO');
    expect(url.searchParams.get('collection')).toBe('Prensa');
    expect(url.searchParams.get('page')).toBe('1');
  });

  it('sorts the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([material(1)]));
    renderPage('PUBLICO');
    await screen.findByText('Acta 1');

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'author');
    await user.selectOptions(screen.getByLabelText('Dirección'), 'desc');

    await screen.findByText('Acta 1');
    expect(lastUrl().searchParams.get('sort')).toBe('author');
    expect(lastUrl().searchParams.get('order')).toBe('desc');
  });

  it('moves between pages', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(page([material(1)], 25, 1))
      .mockResolvedValueOnce(page([material(2)], 25, 2));
    renderPage('PUBLICO');

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹ Anterior' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Siguiente ›' }));

    expect(await screen.findByText('Acta 2')).toBeInTheDocument();
    expect(lastUrl().searchParams.get('page')).toBe('2');
  });

  it('says there are no results and suggests changing the filters', async () => {
    fetchMock.mockResolvedValue(page([]));
    renderPage('PUBLICO');

    expect(
      await screen.findByText('No encontramos material con esa búsqueda.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/cambie los filtros/i)).toBeInTheDocument();
  });

  it('folds the filters behind a "Filtros" button', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([material(1)]));
    renderPage('PUBLICO');
    await screen.findByText('Acta 1');

    const toggle = screen.getByRole('button', { name: /Filtros/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('sends a public user to the request screen with the chosen materials', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([material(1), material(2)]));
    renderPage('PUBLICO');

    expect(screen.getByRole('button', { name: 'Solicitar' })).toBeDisabled();
    await user.click(
      await screen.findByRole('checkbox', { name: 'Seleccionar Acta 1' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Seleccionar Acta 2' }),
    );
    await user.click(screen.getByRole('button', { name: 'Solicitar' }));

    expect(
      screen.getByText(
        `Destino: /solicitudes/nueva?materiales=${material(1).id},${material(2).id}`,
      ),
    ).toBeInTheDocument();
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'sends %s to the staff material screen and loads nothing',
    (role) => {
      renderPage(role);

      expect(
        screen.getByText('Pantalla de material del personal'),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('links to login when the session is not valid', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });
    renderPage('PUBLICO');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Su sesión no es válida o venció.',
    );
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('links a public user to «Mis solicitudes» (HU-11)', async () => {
    fetchMock.mockResolvedValue(page([material(1)]));
    renderPage('PUBLICO');
    await screen.findByRole('table');

    expect(
      screen.getByRole('link', { name: 'Mis solicitudes' }),
    ).toHaveAttribute('href', '/mis-solicitudes');
  });
});
