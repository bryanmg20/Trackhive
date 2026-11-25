import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRoute } from '../auth/components/AdminRoute';
import type {
  CurrentSyncRun,
  SyncRun,
  SyncStatus,
} from './api/everything-sync';
import { BUSY_REFRESH_MS, EverythingSyncPage } from './EverythingSyncPage';

const fetchMock = vi.fn();
const MINUTE = 60_000;

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 3600 }),
  );
  return `header.${payload}.signature`;
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const answer = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const finished = (overrides: Partial<SyncRun> = {}): SyncRun => ({
  id: 'run-ok',
  status: 'OK',
  requestedAt: null,
  startedAt: ago(16 * MINUTE),
  lastActivityAt: ago(15 * MINUTE),
  finishedAt: ago(15 * MINUTE),
  filesCount: 130,
  errorMessage: null,
  ...overrides,
});

const requested = (overrides: Partial<CurrentSyncRun> = {}): CurrentSyncRun => ({
  id: 'run-pedida',
  status: 'PEDIDA',
  requestedAt: ago(3 * MINUTE),
  startedAt: null,
  lastActivityAt: ago(3 * MINUTE),
  finishedAt: null,
  filesCount: 0,
  errorMessage: null,
  expired: false,
  ...overrides,
});

const state = (overrides: Partial<SyncStatus> = {}): SyncStatus => ({
  enabled: true,
  currentRun: null,
  lastRun: finished(),
  agentLastContactAt: ago(40_000),
  ...overrides,
});

/**
 * The API of the sync: each GET of the state answers the next one of
 * `states` (the last one repeats); the POST of «Sincronizar ahora» answers
 * `request`.
 */
function api(
  states: SyncStatus[],
  request: { status: number; body: unknown } = {
    status: 201,
    body: requested({ requestedAt: ago(0), lastActivityAt: ago(0) }),
  },
) {
  let next = 0;
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const { pathname } = new URL(input, 'http://localhost');
    if (pathname === '/api/v1/everything/sync-requests') {
      expect(init?.method).toBe('POST');
      return answer(request.status, request.body);
    }
    expect(pathname).toBe('/api/v1/everything/sync-status');
    const body = states[Math.min(next, states.length - 1)];
    next += 1;
    return answer(200, body);
  });
}

const posts = () =>
  fetchMock.mock.calls.filter(([input]) =>
    String(input).endsWith('/sync-requests'),
  );

function renderPage(role = 'ADMIN') {
  sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  return render(
    <MemoryRouter initialEntries={['/admin/sincronizacion']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route
            path="/admin/sincronizacion"
            element={<EverythingSyncPage />}
          />
        </Route>
        <Route path="/solicitudes" element={<p>Bandeja de personal</p>} />
        <Route path="/materiales" element={<p>Pantalla pública</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const card = (name: string) =>
  screen.getByRole('region', { name }) as HTMLElement;

describe('EverythingSyncPage (HU-138)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the last sync: how long ago, how many folders and that it ended well, and the last contact of the agent', async () => {
    api([state()]);
    renderPage();

    const last = await screen.findByRole('region', {
      name: 'Última sincronización',
    });
    expect(within(last).getByText('Terminó correctamente')).toBeInTheDocument();
    expect(within(last).getByText('hace 15 minutos')).toBeInTheDocument();
    expect(within(last).getByText('130 carpetas recibidas')).toBeInTheDocument();
    expect(
      within(last).getByText('Sincronización diaria del agente'),
    ).toBeInTheDocument();
    expect(within(last).queryByText('Motivo del error')).not.toBeInTheDocument();

    expect(
      within(card('Agente del CLENA')).getByText('hace unos segundos'),
    ).toBeInTheDocument();
    expect(
      within(card('Sincronizar ahora')).getByText(
        'No hay ninguna sincronización pedida ni en curso.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a sync that ended with an error and its reason', async () => {
    api([
      state({
        lastRun: finished({
          status: 'ERROR',
          requestedAt: ago(20 * MINUTE),
          errorMessage: 'Everything no responde en http://127.0.0.1:8081',
        }),
      }),
    ]);
    renderPage();

    const last = await screen.findByRole('region', {
      name: 'Última sincronización',
    });
    expect(within(last).getByText('Terminó con error')).toBeInTheDocument();
    expect(within(last).getByText('Motivo del error')).toBeInTheDocument();
    expect(
      within(last).getByText('Everything no responde en http://127.0.0.1:8081'),
    ).toBeInTheDocument();
    expect(
      within(last).getByText('Pedida con «Sincronizar ahora»'),
    ).toBeInTheDocument();
  });

  it('without any sync nor contact yet, says so without inventing results', async () => {
    api([state({ lastRun: null, agentLastContactAt: null })]);
    renderPage();

    expect(
      await screen.findByText('Todavía no hay sincronizaciones.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El agente todavía no se ha comunicado con Trackhive.'),
    ).toBeInTheDocument();
  });

  it('given I press «Sincronizar ahora», when I confirm, a run is asked for and the screen shows «pedida, esperando al agente»', async () => {
    const user = userEvent.setup();
    api([state(), state({ currentRun: requested({ requestedAt: ago(0) }) })]);
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Sincronizar ahora' }),
    );
    // Nothing is asked for before confirming
    expect(posts()).toHaveLength(0);
    const confirmTitle = screen.getByRole('heading', {
      name: '¿Pedir una sincronización ahora?',
    });
    expect(confirmTitle).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Sí, sincronizar ahora' }));

    expect(posts()).toHaveLength(1);
    expect(
      await screen.findByText('Pedida, esperando al agente'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sincronización pedida: queda esperando al agente del CLENA.',
    );
  });

  it('cancelling the confirmation asks for nothing', async () => {
    const user = userEvent.setup();
    api([state()]);
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Sincronizar ahora' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(posts()).toHaveLength(0);
    expect(
      screen.queryByRole('heading', { name: '¿Pedir una sincronización ahora?' }),
    ).not.toBeInTheDocument();
  });

  it('given the agent has not taken the requested run (the PC is off), shows how long ago it was asked for', async () => {
    api([
      state({
        currentRun: requested({
          requestedAt: ago(3 * 24 * 60 * MINUTE),
          lastActivityAt: ago(3 * 24 * 60 * MINUTE),
        }),
        agentLastContactAt: ago(3 * 24 * 60 * MINUTE + 5 * MINUTE),
      }),
    ]);
    renderPage();

    const now = await screen.findByRole('region', { name: 'Sincronizar ahora' });
    expect(within(now).getByText('Pedida, esperando al agente')).toBeInTheDocument();
    expect(within(now).getByText('hace 3 días')).toBeInTheDocument();
    expect(
      within(card('Agente del CLENA')).getByText('hace 3 días'),
    ).toBeInTheDocument();
  });

  it.each([
    [
      'pedida',
      requested(),
      'Ya hay una sincronización pedida hace 3 minutos que espera al agente, así que no se pidió otra.',
    ],
    [
      'en curso',
      requested({
        status: 'EN_CURSO',
        startedAt: ago(MINUTE),
        lastActivityAt: ago(10_000),
        filesCount: 124,
      }),
      'Ya hay una sincronización en curso, así que no se pidió otra.',
    ],
  ])(
    'given a run %s, when I press «Sincronizar ahora», no other one is asked for and it says so',
    async (_case, current, warning) => {
      const user = userEvent.setup();
      api([state({ currentRun: current })]);
      renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Sincronizar ahora' }),
      );

      expect(screen.getByRole('alert')).toHaveTextContent(warning);
      expect(
        screen.queryByRole('heading', { name: '¿Pedir una sincronización ahora?' }),
      ).not.toBeInTheDocument();
      expect(posts()).toHaveLength(0);
    },
  );

  it('when another administrator asked for it first (the screen was old), the 409 says so and nothing else is asked for', async () => {
    const user = userEvent.setup();
    api(
      [state(), state({ currentRun: requested() })],
      {
        status: 409,
        body: {
          statusCode: 409,
          code: 'SYNC_RUN_ALREADY_REQUESTED',
          message:
            'Ya hay una sincronización pedida que espera al agente del CLENA, así que no se pidió otra.',
        },
      },
    );
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Sincronizar ahora' }),
    );
    await user.click(screen.getByRole('button', { name: 'Sí, sincronizar ahora' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya hay una sincronización pedida que espera al agente del CLENA',
    );
    // The state is read again: the run the other one asked for shows
    expect(
      await screen.findByText('Pedida, esperando al agente'),
    ).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });

  it('a run in progress the agent abandoned does not block a new request', async () => {
    const user = userEvent.setup();
    api([
      state({
        currentRun: requested({
          status: 'EN_CURSO',
          startedAt: ago(50 * MINUTE),
          lastActivityAt: ago(45 * MINUTE),
          expired: true,
        }),
      }),
    ]);
    renderPage();

    expect(
      await screen.findByText('En curso, sin noticias del agente'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));

    expect(
      screen.getByRole('heading', { name: '¿Pedir una sincronización ahora?' }),
    ).toBeInTheDocument();
  });

  it('given the integration is disabled, says so and the button is not available', async () => {
    api([state({ enabled: false })]);
    renderPage();

    expect(
      await screen.findByText('La integración con Everything está desactivada'),
    ).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Sincronizar ahora' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      /no se puede pedir una sincronización/,
    );
  });

  it('when the agent takes the run and ends it, shows the new result without reloading', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const asked = requested({ requestedAt: ago(0), lastActivityAt: ago(0) });
    api(
      [
        state(),
        state({ currentRun: asked }),
        state({
          currentRun: {
            ...asked,
            status: 'EN_CURSO',
            startedAt: ago(0),
            filesCount: 124,
          },
        }),
        state({
          currentRun: null,
          lastRun: finished({
            id: asked.id,
            requestedAt: asked.requestedAt,
            startedAt: ago(0),
            finishedAt: ago(0),
            filesCount: 133,
          }),
        }),
      ],
      { status: 201, body: asked },
    );
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Sincronizar ahora' }),
    );
    await user.click(screen.getByRole('button', { name: 'Sí, sincronizar ahora' }));
    expect(
      await screen.findByText('Pedida, esperando al agente'),
    ).toBeInTheDocument();

    // The agent takes it…
    await act(() => vi.advanceTimersByTimeAsync(BUSY_REFRESH_MS));
    expect(
      await screen.findByText('En curso: el agente está enviando las carpetas'),
    ).toBeInTheDocument();

    // …and ends it: the new result shows and is announced
    await act(() => vi.advanceTimersByTimeAsync(BUSY_REFRESH_MS));
    const last = card('Última sincronización');
    expect(
      await within(last).findByText('133 carpetas recibidas'),
    ).toBeInTheDocument();
    expect(
      within(last).getByText('Pedida con «Sincronizar ahora»'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'La sincronización terminó correctamente: 133 carpetas recibidas.',
    );
    expect(
      screen.getByText('No hay ninguna sincronización pedida ni en curso.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['PERSONAL', 'Bandeja de personal'],
    ['PUBLICO', 'Pantalla pública'],
  ])('%s does not open the screen', (role, home) => {
    api([state()]);
    renderPage(role);

    expect(screen.getByText(home)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a session that expired says how to sign in again', async () => {
    fetchMock.mockResolvedValue(
      answer(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'No' }),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Su sesión no es válida o venció.',
    );
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
