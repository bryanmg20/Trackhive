import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRoute } from '../auth/components/AdminRoute';
import { AttentionTimesPage } from './AttentionTimesPage';

const fetchMock = vi.fn();
const data = {
  from: null,
  to: null,
  completedRequests: 2,
  averageSeconds: 5400,
  states: [
    { state: 'RECIBIDA', requestCount: 2, averageSeconds: 0 },
    { state: 'EN_BUSQUEDA', requestCount: 1, averageSeconds: 3600 },
    { state: 'DISPONIBLE', requestCount: 2, averageSeconds: 1800 },
    { state: 'AGENDADA', requestCount: 0, averageSeconds: null },
  ],
};
const answer = (body: unknown = data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});
function renderPage(role?: string) {
  if (role)
    sessionStorage.setItem(
      'trackhive.accessToken',
      `header.${btoa(JSON.stringify({ role, exp: Date.now() / 1000 + 3600 }))}.signature`,
    );
  return render(
    <MemoryRouter initialEntries={['/reportes/tiempos-de-atencion']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route
            path="/reportes/tiempos-de-atencion"
            element={<AttentionTimesPage />}
          />
        </Route>
        <Route path="/solicitudes" element={<p>Bandeja del personal</p>} />
        <Route path="/materiales" element={<p>Catálogo público</p>} />
        <Route path="/login" element={<p>Inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AttentionTimesPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows sample sizes, a true zero, and no data for a skipped state', async () => {
    fetchMock.mockResolvedValue(answer());
    renderPage('ADMIN');
    expect(await screen.findByText('1,5 h')).toBeInTheDocument();
    expect(screen.getByText('2 solicitudes atendidas')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Recibida' })).getByText('0 s'),
    ).toBeInTheDocument();
    const skipped = screen.getByRole('region', { name: 'Agendada' });
    expect(within(skipped).getByText('Sin datos')).toBeInTheDocument();
    expect(
      within(skipped).getByText('0 solicitudes consideradas'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Tiempos de atención' }),
    ).toHaveAttribute('href', '/reportes/tiempos-de-atencion');
  });

  it.each([
    ['PERSONAL', 'Bandeja del personal'],
    ['PUBLICO', 'Catálogo público'],
    [undefined, 'Inicio de sesión'],
  ])('blocks %s without fetching report data', (role, destination) => {
    renderPage(role);
    expect(screen.getByText(destination as string)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies and clears dates using labelled keyboard controls', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(answer());
    renderPage('ADMIN');
    await screen.findByText('1,5 h');
    const from = screen.getByLabelText('Radicadas desde');
    fireEvent.change(from, { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Radicadas hasta'), {
      target: { value: '2026-11-30' },
    });
    from.focus();
    await user.tab();
    expect(screen.getByLabelText('Radicadas hasta')).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Aplicar fechas' }),
    ).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('from=2026-11-01&to=2026-11-30'),
        expect.anything(),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Quitar fechas' }));
    expect(from).toHaveValue('');
    await waitFor(() =>
      expect(fetchMock.mock.calls.at(-1)?.[0]).not.toContain('from='),
    );
  });

  it('rejects an inverted range locally and preserves entered dates', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(answer());
    renderPage('ADMIN');
    await screen.findByText('1,5 h');
    const before = fetchMock.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Radicadas desde'), {
      target: { value: '2026-11-30' },
    });
    fireEvent.change(screen.getByLabelText('Radicadas hasta'), {
      target: { value: '2026-11-01' },
    });
    await user.click(screen.getByRole('button', { name: 'Aplicar fechas' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La fecha inicial no puede ser posterior',
    );
    expect(screen.getByLabelText('Radicadas desde')).toHaveValue('2026-11-30');
    expect(fetchMock).toHaveBeenCalledTimes(before);
  });

  it('shows an empty sample and allows recovering after a network error', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValue(
      answer({
        ...data,
        completedRequests: 0,
        averageSeconds: null,
        states: [],
      }),
    );
    renderPage('ADMIN');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByText('No hay solicitudes atendidas para este rango.'),
    ).toBeInTheDocument();
  });

  it.each([401, 403])('explains an API %s response', async (status) => {
    fetchMock.mockResolvedValue(answer({ message: 'Error' }, status));
    renderPage('ADMIN');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      status === 401 ? 'Su sesión no es válida o venció.' : 'Solo ADMIN',
    );
    if (status === 401)
      expect(
        within(alert).getByRole('link', { name: 'Iniciar sesión' }),
      ).toBeInTheDocument();
  });
});
