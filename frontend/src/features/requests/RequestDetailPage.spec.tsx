import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRoute } from '../auth/components/StaffRoute';
import { RequestDetailPage } from './RequestDetailPage';
import { RequestsListPage } from './RequestsListPage';

const fetchMock = vi.fn();
const REQUEST_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    trackingCode: 'SOL-2026-00001',
    status: 'AGENDADA',
    deliveryMode: 'PRESENCIAL',
    originChannel: 'WEB',
    reason: 'Consulta para un trabajo de investigación',
    requirementDescription: 'Actas de 1810',
    desiredDate: '2026-12-01',
    committedDate: '2026-12-03',
    registeredAt: '2026-11-10T15:00:00.000Z',
    rejectionReason: null,
    requester: {
      name: 'Juan Carlos Pérez',
      email: 'juan@mail.com',
      phone: '3001234567',
      requesterType: 'INVESTIGADOR',
      institution: 'Universidad de Antioquia',
      documentType: 'CC',
      documentNumber: '123456789',
    },
    materials: [
      {
        id: 'material-1',
        catalogCode: 'TH-DOC-0001',
        title: 'Acta de fundación de la villa',
        materialType: 'DOCUMENTO',
        author: null,
        collection: 'Actas del Cabildo',
        status: 'DISPONIBLE',
        location: { depot: 'D-01', shelf: 'E-01', box: 'C-001' },
        itemStatus: 'LOCALIZADO',
      },
    ],
    ...overrides,
  };
}

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function renderAt(path: string, role?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/solicitudes" element={<RequestsListPage />} />
          <Route path="/solicitudes/:id" element={<RequestDetailPage />} />
        </Route>
        <Route path="/materiales" element={<p>Pantalla de búsqueda</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequestDetailPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'shows requester, material, reason, desired date and status for %s',
    async (role) => {
      fetchMock.mockResolvedValue(ok(detail()));
      renderAt(`/solicitudes/${REQUEST_ID}`, role);

      expect(
        await screen.findByRole('heading', { name: 'SOL-2026-00001' }),
      ).toBeInTheDocument();
      const requester = screen.getByRole('region', { name: 'Solicitante' });
      expect(
        within(requester).getByText('Juan Carlos Pérez'),
      ).toBeInTheDocument();
      expect(within(requester).getByText('juan@mail.com')).toBeInTheDocument();
      expect(within(requester).getByText('Investigador')).toBeInTheDocument();
      expect(within(requester).getByText('CC 123456789')).toBeInTheDocument();

      const request = screen.getByRole('region', { name: 'Solicitud' });
      expect(within(request).getByText('01/12/2026')).toBeInTheDocument();
      expect(within(request).getByText('03/12/2026')).toBeInTheDocument();
      expect(
        within(request).getByText('Consulta para un trabajo de investigación'),
      ).toBeInTheDocument();
      expect(within(request).getAllByText('Agendada').length).toBeGreaterThan(
        0,
      );

      const material = screen.getByRole('region', {
        name: 'Material solicitado',
      });
      expect(
        within(material).getByText('Acta de fundación de la villa'),
      ).toBeInTheDocument();
      expect(within(material).getByText(/TH-DOC-0001/)).toBeInTheDocument();
      expect(
        within(material).getByText(/D-01 · E-01 · C-001/),
      ).toBeInTheDocument();
    },
  );

  it('asks the API for the request of the URL', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');
    await screen.findByRole('heading', { name: 'SOL-2026-00001' });

    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/requests/${REQUEST_ID}`);
  });

  it('shows the rejection reason of a rejected request', async () => {
    fetchMock.mockResolvedValue(
      ok(
        detail({
          status: 'RECHAZADA',
          committedDate: null,
          rejectionReason: 'Material no localizado',
        }),
      ),
    );
    renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');

    expect(
      await screen.findByText('Material no localizado'),
    ).toBeInTheDocument();
    expect(screen.getByText('Motivo del rechazo')).toBeInTheDocument();
  });

  it('does not show a rejection reason when the request was not rejected', async () => {
    fetchMock.mockResolvedValue(ok(detail()));
    renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');
    await screen.findByRole('heading', { name: 'SOL-2026-00001' });

    expect(screen.queryByText('Motivo del rechazo')).not.toBeInTheDocument();
  });

  it('shows a clear message when the request does not exist', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'La solicitud no existe.' }),
    });
    renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No encontramos esa solicitud.',
    );
  });

  it('shows the login link when the session is not valid (401)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });
    renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');

    expect(
      await screen.findByText('Su sesión no es válida o venció.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('sends a PUBLICO user to the public search and loads nothing', () => {
    renderAt(`/solicitudes/${REQUEST_ID}`, 'PUBLICO');

    expect(screen.getByText('Pantalla de búsqueda')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a visitor without a session to the login', () => {
    renderAt(`/solicitudes/${REQUEST_ID}`);

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens from the list when the request is selected and goes back', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith(`/api/v1/requests/${REQUEST_ID}`)
          ? ok(detail())
          : ok({
              items: [
                {
                  id: REQUEST_ID,
                  trackingCode: 'SOL-2026-00001',
                  status: 'AGENDADA',
                  deliveryMode: 'PRESENCIAL',
                  desiredDate: '2026-12-01',
                  registeredAt: '2026-11-10T15:00:00.000Z',
                  requesterName: 'Juan Carlos Pérez',
                  requesterEmail: 'juan@mail.com',
                  materials: [],
                },
              ],
              page: 1,
              limit: 10,
              total: 1,
            }),
      ),
    );
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderAt('/solicitudes', 'PERSONAL');

    await user.click(
      await screen.findByRole('link', { name: 'SOL-2026-00001' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'SOL-2026-00001' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('link', { name: /volver a solicitudes/i }),
    );

    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
