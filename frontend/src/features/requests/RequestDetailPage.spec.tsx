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
    allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
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

  describe('change status (HU-15)', () => {
    const STATUS_PATH = `/api/v1/requests/${REQUEST_ID}/status`;

    function changed(overrides: Record<string, unknown> = {}) {
      return {
        id: REQUEST_ID,
        status: 'ATENDIDA',
        allowedTransitions: ['CERRADA'],
        statusChange: {
          previousStatus: 'AGENDADA',
          newStatus: 'ATENDIDA',
          // 10:30 a. m. in Bogotá
          changedAt: '2026-11-10T15:30:00.000Z',
          changedBy: { id: 'staff-1', name: 'Ana Gómez' },
          comment: null,
        },
        ...overrides,
      };
    }

    // GET answers the detail; PATCH answers `patchResponse`
    function mockApi(
      detailBody: Record<string, unknown>,
      patchResponse: unknown = ok(changed()),
    ) {
      fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'PATCH' ? patchResponse : ok(detailBody),
        ),
      );
    }

    function patchCalls() {
      return fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
      ) as [string, RequestInit][];
    }

    async function setup(detailBody = detail(), patchResponse?: unknown) {
      mockApi(detailBody, patchResponse);
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();
      renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');
      const section = await screen.findByRole('region', {
        name: 'Cambiar estado',
      });
      return { user, section };
    }

    it('offers only the valid transitions of a scheduled request: attended or not', async () => {
      const { section } = await setup();

      const options = within(section).getAllByRole('radio');
      expect(options).toHaveLength(2);
      expect(
        within(section).getByRole('radio', { name: 'El solicitante asistió' }),
      ).toHaveAccessibleDescription('Pasa a Atendida.');
      expect(
        within(section).getByRole('radio', {
          name: 'El solicitante no asistió',
        }),
      ).toHaveAccessibleDescription('Vuelve a Disponible para agendar de nuevo.');
    });

    it('does not offer Rechazada: rejecting needs a reason (HU-16)', async () => {
      const { section } = await setup(
        detail({
          status: 'RECIBIDA',
          committedDate: null,
          allowedTransitions: ['EN_BUSQUEDA', 'RECHAZADA'],
        }),
      );

      const options = within(section).getAllByRole('radio');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveAccessibleName('En búsqueda');
      expect(
        within(section).queryByRole('radio', { name: 'Rechazada' }),
      ).not.toBeInTheDocument();
    });

    it.each(['CERRADA', 'RECHAZADA'])(
      'shows no action for a request in the final status %s',
      async (status) => {
        const { section } = await setup(
          detail({
            status,
            committedDate: null,
            allowedTransitions: [],
            rejectionReason:
              status === 'RECHAZADA' ? 'Material no localizado' : null,
          }),
        );

        expect(section).toHaveTextContent(
          'es un estado final y no admite más cambios',
        );
        expect(within(section).queryByRole('radio')).not.toBeInTheDocument();
        expect(
          within(section).queryByRole('button', { name: 'Guardar cambio' }),
        ).not.toBeInTheDocument();
      },
    );

    it('marks that the requester attended and shows when, who and the new status', async () => {
      const { user, section } = await setup(
        detail(),
        ok(
          changed({
            statusChange: {
              ...changed().statusChange,
              comment: 'Consultó las actas',
            },
          }),
        ),
      );

      await user.click(
        within(section).getByRole('radio', { name: 'El solicitante asistió' }),
      );
      await user.type(
        within(section).getByLabelText('Comentario (opcional)'),
        'Consultó las actas',
      );
      await user.click(
        within(section).getByRole('button', { name: 'Guardar cambio' }),
      );

      const confirmation = await within(section).findByRole('status');
      expect(confirmation).toHaveTextContent(
        /pasó de Agendada a Atendida el 10\/11\/2026 a las 10:30.*por Ana Gómez/,
      );

      const [[url, init]] = patchCalls();
      expect(url).toBe(STATUS_PATH);
      expect(JSON.parse(init.body as string)).toEqual({
        status: 'ATENDIDA',
        comment: 'Consultó las actas',
      });

      // The badge and the next transitions follow the new status
      const heading = screen.getByRole('heading', { name: 'SOL-2026-00001' });
      expect(heading.parentElement).toHaveTextContent('Atendida');
      expect(
        within(section).getByRole('radio', { name: 'Cerrada' }),
      ).not.toBeChecked();
      expect(within(section).getByLabelText('Comentario (opcional)')).toHaveValue(
        '',
      );
    });

    it('marks that the requester did not attend: the request goes back to Disponible', async () => {
      const { user, section } = await setup(
        detail(),
        ok(
          changed({
            status: 'DISPONIBLE',
            allowedTransitions: ['AGENDADA', 'CERRADA'],
            statusChange: {
              ...changed().statusChange,
              newStatus: 'DISPONIBLE',
            },
          }),
        ),
      );

      await user.click(
        within(section).getByRole('radio', {
          name: 'El solicitante no asistió',
        }),
      );
      await user.click(
        within(section).getByRole('button', { name: 'Guardar cambio' }),
      );

      expect(await within(section).findByRole('status')).toHaveTextContent(
        'pasó de Agendada a Disponible',
      );
      // Without a comment, none is sent
      expect(JSON.parse(patchCalls()[0][1].body as string)).toEqual({
        status: 'DISPONIBLE',
      });
      // Agendada is not an option here: it needs an appointment (HU-18)
      expect(
        within(section).queryByRole('radio', { name: 'Agendada' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Agendar cita' }),
      ).toBeInTheDocument();
    });

    it('asks to choose the new status before saving', async () => {
      const { user, section } = await setup();

      await user.click(
        within(section).getByRole('button', { name: 'Guardar cambio' }),
      );

      expect(within(section).getByRole('alert')).toHaveTextContent(
        'Elija el nuevo estado.',
      );
      expect(patchCalls()).toHaveLength(0);
    });

    it('shows the backend error of an invalid transition and keeps the status', async () => {
      const { user, section } = await setup(detail(), {
        ok: false,
        status: 409,
        json: async () => ({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'No se puede pasar una solicitud de Agendada a Atendida',
        }),
      });

      await user.click(
        within(section).getByRole('radio', { name: 'El solicitante asistió' }),
      );
      await user.click(
        within(section).getByRole('button', { name: 'Guardar cambio' }),
      );

      expect(await within(section).findByRole('alert')).toHaveTextContent(
        'No se puede pasar una solicitud de Agendada a Atendida',
      );
      const heading = screen.getByRole('heading', { name: 'SOL-2026-00001' });
      expect(heading.parentElement).toHaveTextContent('Agendada');
      expect(within(section).queryByRole('status')).not.toBeInTheDocument();
    });

    it('explains a 403 without showing the raw error', async () => {
      const { user, section } = await setup(detail(), {
        ok: false,
        status: 403,
        json: async () => ({ code: 'FORBIDDEN', message: 'Forbidden resource' }),
      });

      await user.click(
        within(section).getByRole('radio', { name: 'El solicitante asistió' }),
      );
      await user.click(
        within(section).getByRole('button', { name: 'Guardar cambio' }),
      );

      expect(await within(section).findByRole('alert')).toHaveTextContent(
        'No tiene permiso para cambiar el estado de la solicitud.',
      );
    });

    it('can be used with the keyboard only', async () => {
      const { user, section } = await setup();

      within(section)
        .getByRole('radio', { name: 'El solicitante asistió' })
        .focus();
      await user.keyboard(' ');
      expect(
        within(section).getByRole('radio', { name: 'El solicitante asistió' }),
      ).toBeChecked();

      await user.tab();
      expect(within(section).getByLabelText('Comentario (opcional)')).toHaveFocus();
      await user.keyboard('Asistió');
      await user.tab();
      expect(
        within(section).getByRole('button', { name: 'Guardar cambio' }),
      ).toHaveFocus();
      await user.keyboard('{Enter}');

      expect(await within(section).findByRole('status')).toBeInTheDocument();
      expect(JSON.parse(patchCalls()[0][1].body as string)).toEqual({
        status: 'ATENDIDA',
        comment: 'Asistió',
      });
    });
  });

  describe('schedule appointment (HU-18)', () => {
    const APPOINTMENTS_PATH = `/api/v1/requests/${REQUEST_ID}/appointments`;

    const available = (overrides: Record<string, unknown> = {}) =>
      detail({
        status: 'DISPONIBLE',
        allowedTransitions: ['AGENDADA', 'CERRADA'],
        ...overrides,
      });

    function scheduled(overrides: Record<string, unknown> = {}) {
      return {
        id: REQUEST_ID,
        status: 'AGENDADA',
        allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
        appointment: {
          id: 'appointment-1',
          date: '2026-11-20',
          serviceHours: { opensAt: '08:00', closesAt: '17:00' },
          status: 'PROGRAMADA',
          requester: { id: 'requester-1', name: 'Juan Carlos Pérez' },
          materials: [
            {
              id: 'material-1',
              catalogCode: 'TH-DOC-0001',
              title: 'Acta de fundación de la villa',
            },
          ],
        },
        statusChange: {
          previousStatus: 'DISPONIBLE',
          newStatus: 'AGENDADA',
          changedAt: '2026-11-10T15:30:00.000Z',
          changedBy: { id: 'staff-1', name: 'Ana Gómez' },
          comment: null,
        },
        ...overrides,
      };
    }

    // GET answers the detail; POST answers `postResponse`
    async function setup(
      detailBody: Record<string, unknown> = available(),
      postResponse: unknown = {
        ok: true,
        status: 201,
        json: async () => scheduled(),
      },
    ) {
      fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'POST' ? postResponse : ok(detailBody),
        ),
      );
      const { default: userEvent } =
        await import('@testing-library/user-event');
      const user = userEvent.setup();
      renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');
      await screen.findByRole('heading', { name: 'SOL-2026-00001' });
      return { user };
    }

    function postCalls() {
      return fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      ) as [string, RequestInit][];
    }

    it('does not offer Agendada in «Cambiar estado» for a Disponible request', async () => {
      await setup();

      const changeStatus = screen.getByRole('region', {
        name: 'Cambiar estado',
      });
      expect(
        within(changeStatus).queryByRole('radio', { name: 'Agendada' }),
      ).not.toBeInTheDocument();
      expect(within(changeStatus).getAllByRole('radio')).toHaveLength(1);
      expect(
        within(changeStatus).getByRole('radio', { name: 'Cerrada' }),
      ).toBeInTheDocument();
    });

    it('schedules the chosen day and shows the hours, the requester and the material', async () => {
      const { user } = await setup();
      const section = screen.getByRole('region', { name: 'Agendar cita' });

      await user.clear(within(section).getByLabelText('Fecha de la cita'));
      await user.type(
        within(section).getByLabelText('Fecha de la cita'),
        '2026-11-20',
      );
      await user.click(
        within(section).getByRole('button', { name: 'Agendar cita' }),
      );

      const confirmation = await within(section).findByRole('status');
      expect(confirmation).toHaveTextContent(
        'Cita agendada para el viernes 20/11/2026. Juan Carlos Pérez puede consultar el material durante todo el horario de atención, de 8:00 a 17:00.',
      );
      expect(
        within(confirmation).getByText(
          'Acta de fundación de la villa (TH-DOC-0001)',
        ),
      ).toBeInTheDocument();

      const [[url, init]] = postCalls();
      expect(url).toBe(APPOINTMENTS_PATH);
      expect(JSON.parse(init.body as string)).toEqual({ date: '2026-11-20' });

      // The request is now Agendada and cannot be scheduled again
      const heading = screen.getByRole('heading', { name: 'SOL-2026-00001' });
      expect(heading.parentElement).toHaveTextContent('Agendada');
      expect(
        within(section).queryByRole('button', { name: 'Agendar cita' }),
      ).not.toBeInTheDocument();
      // «Cambiar estado» now offers attended or not
      expect(
        screen.getByRole('radio', { name: 'El solicitante asistió' }),
      ).toBeInTheDocument();
    });

    it('shows the backend error for a Sunday and keeps the status', async () => {
      const { user } = await setup(available(), {
        ok: false,
        status: 400,
        json: async () => ({
          code: 'INVALID_APPOINTMENT_DATE',
          message:
            'El CLENA no atiende los domingos. Elija una fecha de lunes a sábado.',
        }),
      });
      const section = screen.getByRole('region', { name: 'Agendar cita' });

      await user.clear(within(section).getByLabelText('Fecha de la cita'));
      await user.type(
        within(section).getByLabelText('Fecha de la cita'),
        '2026-11-22',
      );
      await user.click(
        within(section).getByRole('button', { name: 'Agendar cita' }),
      );

      expect(await within(section).findByRole('alert')).toHaveTextContent(
        'El CLENA no atiende los domingos. Elija una fecha de lunes a sábado.',
      );
      const heading = screen.getByRole('heading', { name: 'SOL-2026-00001' });
      expect(heading.parentElement).toHaveTextContent('Disponible');
    });

    it('shows the date the requester asked for and starts on it', async () => {
      const { user } = await setup();
      const section = screen.getByRole('region', { name: 'Agendar cita' });
      const input = within(section).getByLabelText('Fecha de la cita');

      expect(section).toHaveTextContent(
        'El solicitante pidió el martes 01/12/2026.',
      );
      expect(input).toHaveValue('2026-12-01');
      expect(input).toHaveAccessibleDescription(
        /El solicitante pidió el martes 01\/12\/2026\./,
      );

      // Without changing it, the desired date is sent
      await user.click(
        within(section).getByRole('button', { name: 'Agendar cita' }),
      );
      await within(section).findByRole('status');
      expect(JSON.parse(postCalls()[0][1].body as string)).toEqual({
        date: '2026-12-01',
      });
    });

    it('asks to choose the date before scheduling', async () => {
      const { user } = await setup();
      const section = screen.getByRole('region', { name: 'Agendar cita' });

      await user.clear(within(section).getByLabelText('Fecha de la cita'));
      await user.click(
        within(section).getByRole('button', { name: 'Agendar cita' }),
      );

      expect(within(section).getByRole('alert')).toHaveTextContent(
        'Elija la fecha de la cita.',
      );
      expect(postCalls()).toHaveLength(0);
    });

    it.each([
      ['RECIBIDA', 'PRESENCIAL', ['EN_BUSQUEDA', 'RECHAZADA']],
      ['AGENDADA', 'PRESENCIAL', ['DISPONIBLE', 'ATENDIDA']],
      // A digital delivery is attended without an appointment
      ['DISPONIBLE', 'DIGITAL', ['ATENDIDA', 'CERRADA']],
    ])(
      'offers no appointment for a %s request with %s delivery',
      async (status, deliveryMode, allowedTransitions) => {
        await setup(detail({ status, deliveryMode, allowedTransitions }));

        expect(
          screen.queryByRole('region', { name: 'Agendar cita' }),
        ).not.toBeInTheDocument();
      },
    );
  });
});
