import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRoute } from '../auth/components/StaffRoute';
import { RequestDetailPage } from './RequestDetailPage';
import { RequestsListPage } from './RequestsListPage';

const fetchMock = vi.fn();
// The history (HU-17) and occupancy (HU-20.1) have their own mocks, so the
// other calls keep their order
const historyMock = vi.fn();
const occupancyMock = vi.fn();
const REQUEST_ID = '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';

function history(entries: unknown[] = [registrationEntry()]) {
  return { requestId: REQUEST_ID, trackingCode: 'SOL-2026-00001', entries };
}

function registrationEntry() {
  return {
    id: '1',
    previousStatus: null,
    newStatus: 'RECIBIDA',
    // 10:00 a. m. in Bogotá
    changedAt: '2026-11-10T15:00:00.000Z',
    changedBy: 'Juan Carlos Pérez',
    comment: null,
  };
}

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function detail(overrides: Record<string, unknown> = {}) {
  // What the backend derives from the entity: the reason of RECHAZADA is
  // required whenever it is allowed (HU-16)
  const allowed = (overrides.allowedTransitions ?? [
    'DISPONIBLE',
    'ATENDIDA',
  ]) as string[];
  return {
    commentRequiredFor: allowed.filter((status) => status === 'RECHAZADA'),
    canResolveReferences: false,
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
    references: [],
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
    historyMock.mockReset();
    occupancyMock.mockReset();
    historyMock.mockResolvedValue(ok(history()));
    occupancyMock.mockResolvedValue(
      ok({
        dailyCapacity: 15,
        days: [
          {
            date: '2026-12-01',
            occupied: 2,
            available: 13,
            isFull: false,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url.endsWith('/history')) return historyMock(url, init);
      if (url.includes('/appointments/occupancy')) {
        return occupancyMock(url, init);
      }
      return fetchMock(url, init);
    });
  });

  describe('status history (HU-17)', () => {
    it('shows each change with the previous and new status, date, responsible and comment', async () => {
      fetchMock.mockResolvedValue(ok(detail({ status: 'EN_BUSQUEDA' })));
      historyMock.mockResolvedValue(
        ok(
          history([
            registrationEntry(),
            {
              id: '2',
              previousStatus: 'RECIBIDA',
              newStatus: 'EN_BUSQUEDA',
              changedAt: '2026-11-11T14:30:00.000Z',
              changedBy: 'Ana Gómez',
              comment: 'Se busca en el depósito D-01',
            },
          ]),
        ),
      );
      renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');

      const section = await screen.findByRole('region', {
        name: 'Historial de estados',
      });
      const timeline = await within(section).findByRole('list', {
        name: 'Historial de estados de SOL-2026-00001',
      });
      const [first, second] = within(timeline).getAllByRole('listitem');
      expect(first).toHaveTextContent(/Solicitud registrada: Recibida/);
      expect(first).toHaveTextContent(/10\/11\/2026.*10:00/);
      expect(first).toHaveTextContent('Responsable: Juan Carlos Pérez');
      expect(second).toHaveTextContent(/Recibida.*En búsqueda/);
      expect(second).toHaveTextContent(/11\/11\/2026.*09:30/);
      expect(second).toHaveTextContent('Responsable: Ana Gómez');
      expect(second).toHaveTextContent(
        'Observación: Se busca en el depósito D-01',
      );
      expect(historyMock).toHaveBeenCalledWith(
        `/api/v1/requests/${REQUEST_ID}/history`,
        expect.anything(),
      );
    });

    it('offers no way to edit or delete a row of the history', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');

      const section = await screen.findByRole('region', {
        name: 'Historial de estados',
      });
      await within(section).findByRole('list');
      expect(within(section).queryByRole('button')).not.toBeInTheDocument();
      expect(within(section).queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('shows the error of the history without hiding the rest of the detail', async () => {
      fetchMock.mockResolvedValue(ok(detail()));
      historyMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Error interno' }),
      });
      renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');

      const section = await screen.findByRole('region', {
        name: 'Historial de estados',
      });
      expect(await within(section).findByRole('alert')).toHaveTextContent(
        'Error interno',
      );
      expect(
        screen.getByRole('region', { name: 'Solicitante' }),
      ).toBeInTheDocument();
    });
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
                  references: [],
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
        rejectionReason: null,
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

    it('offers Rechazada next to the other valid transitions (HU-16)', async () => {
      const { section } = await setup(
        detail({
          status: 'RECIBIDA',
          committedDate: null,
          allowedTransitions: ['EN_BUSQUEDA', 'RECHAZADA'],
        }),
      );

      const options = within(section).getAllByRole('radio');
      expect(options.map((option) => option.getAttribute('value'))).toEqual([
        'EN_BUSQUEDA',
        'RECHAZADA',
      ]);
      expect(
        within(section).getByRole('radio', { name: 'Rechazada' }),
      ).toHaveAccessibleDescription(
        'No se atenderá. Debe escribir el motivo, que verá el solicitante.',
      );
    });

    it('does not offer Rechazada when the state machine does not allow it', async () => {
      const { section } = await setup();

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

      // The history is loaded again and shows the new change (HU-17)
      await waitFor(() => expect(historyMock).toHaveBeenCalledTimes(2));

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

    describe('reject with a reason (HU-16)', () => {
      const REASON = 'El material está restringido por la familia donante';
      const received = () =>
        detail({
          status: 'RECIBIDA',
          committedDate: null,
          allowedTransitions: ['EN_BUSQUEDA', 'RECHAZADA'],
        });
      const rejected = () =>
        ok(
          changed({
            status: 'RECHAZADA',
            allowedTransitions: [],
            rejectionReason: REASON,
            statusChange: {
              ...changed().statusChange,
              previousStatus: 'RECIBIDA',
              newStatus: 'RECHAZADA',
              comment: REASON,
            },
          }),
        );

      it('turns the comment into the required reason when Rechazada is chosen', async () => {
        const { user, section } = await setup(received());

        expect(
          within(section).getByLabelText('Comentario (opcional)'),
        ).not.toBeRequired();

        await user.click(within(section).getByRole('radio', { name: 'Rechazada' }));

        const reason = within(section).getByLabelText(
          'Motivo del rechazo (obligatorio)',
        );
        expect(reason).toBeRequired();
        expect(reason).toHaveAccessibleDescription(
          'El solicitante lo verá en «Mis solicitudes».',
        );
      });

      it.each([
        ['empty', ''],
        ['blank', '    '],
      ])(
        'shows the error and saves nothing when the reason is %s',
        async (_case, typed) => {
          const { user, section } = await setup(received());

          await user.click(
            within(section).getByRole('radio', { name: 'Rechazada' }),
          );
          const reason = within(section).getByLabelText(
            'Motivo del rechazo (obligatorio)',
          );
          if (typed) await user.type(reason, typed);
          await user.click(
            within(section).getByRole('button', { name: 'Guardar cambio' }),
          );

          expect(within(section).getByRole('alert')).toHaveTextContent(
            'Escriba el motivo del rechazo: el solicitante lo verá en «Mis solicitudes».',
          );
          expect(reason).toHaveAttribute('aria-invalid', 'true');
          expect(reason).toHaveFocus();
          expect(patchCalls()).toHaveLength(0);
          // Nothing changed on the page
          const heading = screen.getByRole('heading', {
            name: 'SOL-2026-00001',
          });
          expect(heading.parentElement).toHaveTextContent('Recibida');
        },
      );

      it('clears the error as soon as the reason is typed', async () => {
        const { user, section } = await setup(received());

        await user.click(within(section).getByRole('radio', { name: 'Rechazada' }));
        await user.click(
          within(section).getByRole('button', { name: 'Guardar cambio' }),
        );
        await user.type(
          within(section).getByLabelText('Motivo del rechazo (obligatorio)'),
          'M',
        );

        expect(within(section).queryByRole('alert')).not.toBeInTheDocument();
      });

      it('rejects with the reason and shows it on the page', async () => {
        const { user, section } = await setup(received(), rejected());

        await user.click(within(section).getByRole('radio', { name: 'Rechazada' }));
        await user.type(
          within(section).getByLabelText('Motivo del rechazo (obligatorio)'),
          REASON,
        );
        await user.click(
          within(section).getByRole('button', { name: 'Guardar cambio' }),
        );

        expect(await within(section).findByRole('status')).toHaveTextContent(
          `pasó de Recibida a Rechazada`,
        );
        expect(within(section).getByRole('status')).toHaveTextContent(
          `Motivo: «${REASON}»`,
        );
        expect(JSON.parse(patchCalls()[0][1].body as string)).toEqual({
          status: 'RECHAZADA',
          comment: REASON,
        });

        // The «Solicitud» card shows the reason and the request is final now
        const requestCard = screen.getByRole('region', { name: 'Solicitud' });
        expect(within(requestCard).getByText('Motivo del rechazo')).toBeInTheDocument();
        expect(within(requestCard).getByText(REASON)).toBeInTheDocument();
        expect(section).toHaveTextContent(
          'es un estado final y no admite más cambios',
        );
      });

      it('shows the backend error when it refuses the rejection', async () => {
        const { user, section } = await setup(received(), {
          ok: false,
          status: 400,
          json: async () => ({
            code: 'REJECTION_REASON_REQUIRED',
            message: 'El motivo del rechazo es obligatorio',
          }),
        });

        await user.click(within(section).getByRole('radio', { name: 'Rechazada' }));
        await user.type(
          within(section).getByLabelText('Motivo del rechazo (obligatorio)'),
          'x',
        );
        await user.click(
          within(section).getByRole('button', { name: 'Guardar cambio' }),
        );

        expect(await within(section).findByRole('alert')).toHaveTextContent(
          'El motivo del rechazo es obligatorio',
        );
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

    it('shows the double-booking conflict and creates no appointment (HU-20)', async () => {
      const message =
        'El material «Acta de fundación de la villa» (TH-DOC-0001) ya tiene ' +
        'cita el viernes, 20 de noviembre de 2026 (solicitud SOL-2026-00002).';
      const { user } = await setup(available(), {
        ok: false,
        status: 409,
        json: async () => ({
          code: 'MATERIAL_ALREADY_BOOKED',
          message,
        }),
      });
      const section = screen.getByRole('region', { name: 'Agendar cita' });

      await user.clear(within(section).getByLabelText('Fecha de la cita'));
      await user.type(
        within(section).getByLabelText('Fecha de la cita'),
        '2026-11-20',
      );
      await user.click(
        within(section).getByRole('button', { name: 'Agendar cita' }),
      );

      expect(await within(section).findByRole('alert')).toHaveTextContent(
        message,
      );
      // The appointment was not scheduled: no confirmation and still Disponible
      expect(within(section).queryByRole('status')).not.toBeInTheDocument();
      const heading = screen.getByRole('heading', { name: 'SOL-2026-00001' });
      expect(heading.parentElement).toHaveTextContent('Disponible');
      expect(
        within(section).getByRole('button', { name: 'Agendar cita' }),
      ).toBeInTheDocument();
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

    it('shows daily room occupancy and warns when the selected day is full (HU-20.1)', async () => {
      occupancyMock.mockResolvedValue(
        ok({
          dailyCapacity: 15,
          days: [
            {
              date: '2026-12-01',
              occupied: 15,
              available: 0,
              isFull: true,
            },
          ],
        }),
      );
      await setup();

      const section = screen.getByRole('region', { name: 'Agendar cita' });
      expect(
        await within(section).findByText(
          'La sala alcanzó su capacidad diaria (15 de 15 citas).',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('reading room delivery and return (HU-72)', () => {
    it('lets staff deliver a material for today appointment from the request detail', async () => {
      const todayIso = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const APPOINTMENT_ID = '00000000-0000-4000-8000-000000000099';
      const MATERIAL_ID = '00000000-0000-4000-8000-000000000011';

      const beforeDelivery = detail({
        status: 'AGENDADA',
        allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
        activeAppointment: {
          id: APPOINTMENT_ID,
          date: todayIso,
          serviceHours: { opensAt: '08:00', closesAt: '17:00' },
          status: 'PROGRAMADA',
          materials: [
            {
              id: MATERIAL_ID,
              catalogCode: 'TH-DOC-0001',
              title: 'Acta de fundación de la villa',
              status: 'DISPONIBLE',
              activeLoan: null,
              lastLoan: null,
            },
          ],
        },
      });

      const afterDelivery = detail({
        status: 'AGENDADA',
        allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
        activeAppointment: {
          id: APPOINTMENT_ID,
          date: todayIso,
          serviceHours: { opensAt: '08:00', closesAt: '17:00' },
          status: 'PROGRAMADA',
          materials: [
            {
              id: MATERIAL_ID,
              catalogCode: 'TH-DOC-0001',
              title: 'Acta de fundación de la villa',
              status: 'EN_USO',
              activeLoan: {
                id: 'loan-1',
                handedOverAt: '2026-11-19T14:30:00.000Z',
                handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
                deliveryNotes: 'Con guantes',
                returnedAt: null,
                returnedBy: null,
                returnNotes: null,
              },
              lastLoan: {
                id: 'loan-1',
                handedOverAt: '2026-11-19T14:30:00.000Z',
                handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
                deliveryNotes: 'Con guantes',
                returnedAt: null,
                returnedBy: null,
                returnNotes: null,
              },
            },
          ],
        },
      });

      let delivered = false;
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'POST' && url.endsWith('/deliver')) {
          delivered = true;
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({
              id: 'loan-1',
              materialId: MATERIAL_ID,
              materialCatalogCode: 'TH-DOC-0001',
              materialTitle: 'Acta de fundación de la villa',
              materialStatus: 'EN_USO',
              appointment: {
                id: APPOINTMENT_ID,
                date: todayIso,
                requestId: REQUEST_ID,
                trackingCode: 'SOL-2026-00001',
              },
              requester: { id: 'req-1', name: 'Juan Carlos Pérez' },
              handedOverAt: '2026-11-19T14:30:00.000Z',
              handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
              deliveryNotes: 'Con guantes',
              returnedAt: null,
              returnedBy: null,
              returnNotes: null,
            }),
          });
        }
        return Promise.resolve(ok(delivered ? afterDelivery : beforeDelivery));
      });

      const { default: userEvent } =
        await import('@testing-library/user-event');
      const user = userEvent.setup();
      renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');

      const deliverBtn = await screen.findByRole('button', {
        name: /registrar entrega de acta de fundación de la villa/i,
      });
      await user.click(deliverBtn);

      const dialog = screen.getByRole('dialog', {
        name: /registrar entrega de material/i,
      });
      await user.type(
        within(dialog).getByLabelText(/observaciones/i),
        'Con guantes',
      );
      await user.click(
        within(dialog).getByRole('button', { name: 'Confirmar entrega' }),
      );

      expect(
        await screen.findByRole('button', {
          name: /registrar devolución de acta de fundación de la villa/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(/por Ana Gómez/)).toBeInTheDocument();
    });
  });

  describe('written references (HU-09.2)', () => {
    const REFERENCE_ID = '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f';
    const pendingReference = {
      id: REFERENCE_ID,
      kind: 'TEXTO_LIBRE',
      label: 'El Heraldo, 15-03-1950',
      notary: null,
      year: null,
      deedNumber: null,
      description: 'El Heraldo, 15-03-1950',
      status: 'PENDIENTE',
      displayStatus: 'PENDIENTE',
      material: null,
      resolvedAt: null,
      resolvedBy: null,
    };
    // The backend asks for the comment of DISPONIBLE while one is pending
    const searching = (references: unknown[] = [pendingReference]) =>
      detail({
        status: 'EN_BUSQUEDA',
        committedDate: null,
        allowedTransitions: ['DISPONIBLE', 'RECHAZADA'],
        commentRequiredFor: (references as { status: string }[]).some(
          ({ status }) => status === 'PENDIENTE',
        )
          ? ['DISPONIBLE', 'RECHAZADA']
          : ['RECHAZADA'],
        canResolveReferences: true,
        materials: [],
        references,
      });

    async function open() {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();
      renderAt(`/solicitudes/${REQUEST_ID}`, 'PERSONAL');
      const section = await screen.findByRole('region', {
        name: 'Referencias de material no catalogado',
      });
      return { user, section };
    }

    it('shows each reference with its status and explains what blocks the request', async () => {
      fetchMock.mockResolvedValue(ok(searching()));

      const { section } = await open();

      expect(within(section).getByText('El Heraldo, 15-03-1950')).toBeInTheDocument();
      expect(within(section).getByText('Pendiente')).toBeInTheDocument();
      expect(within(section).getByRole('note')).toHaveTextContent(
        'explicando en el comentario qué se entrega y cómo',
      );
      expect(
        screen.getByText(/Aún no hay material del catálogo/),
      ).toBeInTheDocument();
    });

    it('associates the catalog material found by the staff and reloads the request', async () => {
      const material = {
        id: 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc',
        catalogCode: 'TH-PER-0101',
        title: 'El Heraldo, 15-03-1950',
        materialType: 'PERIODICO',
        author: null,
        collection: 'Prensa',
        status: 'DISPONIBLE',
      };
      const resolvedReference = {
        ...pendingReference,
        status: 'RESUELTA',
        displayStatus: 'RESUELTA',
        material: {
          id: material.id,
          catalogCode: material.catalogCode,
          title: material.title,
        },
        resolvedAt: '2026-11-20T15:00:00.000Z',
        resolvedBy: { id: 'staff-1', name: 'Ana Gómez' },
      };
      let resolved = false;
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url.startsWith('/api/v1/materials')) {
          return Promise.resolve(
            ok({ items: [material], page: 1, limit: 10, total: 1 }),
          );
        }
        if (init?.method === 'PATCH') {
          resolved = true;
          return Promise.resolve(
            ok({
              requestId: REQUEST_ID,
              reference: resolvedReference,
              historyEntry: {
                previousStatus: 'EN_BUSQUEDA',
                newStatus: 'EN_BUSQUEDA',
                changedAt: '2026-11-20T15:00:00.000Z',
                changedBy: { id: 'staff-1', name: 'Ana Gómez' },
                comment: 'Referencia asociada',
              },
            }),
          );
        }
        return Promise.resolve(
          ok(searching([resolved ? resolvedReference : pendingReference])),
        );
      });
      const { user, section } = await open();

      await user.click(
        within(section).getByRole('button', {
          name: 'Asociar material a El Heraldo, 15-03-1950',
        }),
      );
      expect(
        within(section).getByLabelText('Buscar el material en el catálogo'),
      ).toHaveValue('El Heraldo, 15-03-1950');
      await user.click(within(section).getByRole('button', { name: 'Buscar' }));
      await user.click(
        await within(section).findByRole('button', {
          name: `Asociar ${material.title}`,
        }),
      );

      expect(
        await within(section).findByText(/Material asociado: TH-PER-0101/),
      ).toHaveTextContent('por Ana Gómez');
      const patch = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
      ) as [string, RequestInit];
      expect(patch[0]).toBe(
        `/api/v1/requests/${REQUEST_ID}/references/${REFERENCE_ID}`,
      );
      expect(JSON.parse(patch[1].body as string)).toEqual({
        materialId: material.id,
      });
      // The history reloads to show who associated it
      await waitFor(() => expect(historyMock).toHaveBeenCalledTimes(2));
    });

    it('asks next to the field what is delivered before Disponible with a reference without material', async () => {
      fetchMock.mockResolvedValue(ok(searching()));
      const { user } = await open();
      const statusSection = screen.getByRole('region', {
        name: 'Cambiar estado',
      });

      await user.click(
        within(statusSection).getByRole('radio', { name: 'Disponible' }),
      );
      expect(
        within(statusSection).getByLabelText(
          'Qué se entrega y cómo (obligatorio)',
        ),
      ).toHaveAttribute('aria-required', 'true');
      await user.click(
        within(statusSection).getByRole('button', { name: 'Guardar cambio' }),
      );

      expect(await within(statusSection).findByRole('alert')).toHaveTextContent(
        'explique qué se entrega y cómo',
      );
      expect(
        within(statusSection).getByLabelText(
          'Qué se entrega y cómo (obligatorio)',
        ),
      ).toHaveFocus();
      expect(
        fetchMock.mock.calls.some(
          ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
        ),
      ).toBe(false);
    });

    it('only asks for the comment the backend requires, without deducing the rule', async () => {
      // A pending reference, but the backend does not list DISPONIBLE
      fetchMock.mockResolvedValue(
        ok({ ...searching(), commentRequiredFor: ['RECHAZADA'] }),
      );
      const { user } = await open();
      const statusSection = screen.getByRole('region', {
        name: 'Cambiar estado',
      });

      await user.click(
        within(statusSection).getByRole('radio', { name: 'Disponible' }),
      );

      expect(
        within(statusSection).getByLabelText('Comentario (opcional)'),
      ).toBeInTheDocument();
    });

    it('sends Disponible with the comment that explains the delivery', async () => {
      fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'PATCH'
            ? ok({
                id: REQUEST_ID,
                status: 'DISPONIBLE',
                allowedTransitions: ['AGENDADA', 'CERRADA'],
                rejectionReason: null,
                statusChange: {
                  previousStatus: 'EN_BUSQUEDA',
                  newStatus: 'DISPONIBLE',
                  changedAt: '2026-11-20T15:00:00.000Z',
                  changedBy: { id: 'staff-1', name: 'Ana Gómez' },
                  comment: 'Localizada en físico, se consulta en sala',
                },
              })
            : ok(searching()),
        ),
      );
      const { user } = await open();
      const statusSection = screen.getByRole('region', {
        name: 'Cambiar estado',
      });

      await user.click(
        within(statusSection).getByRole('radio', { name: 'Disponible' }),
      );
      await user.type(
        within(statusSection).getByLabelText(
          'Qué se entrega y cómo (obligatorio)',
        ),
        'Localizada en físico, se consulta en sala',
      );
      await user.click(
        within(statusSection).getByRole('button', { name: 'Guardar cambio' }),
      );

      expect(await within(statusSection).findByRole('status')).toBeInTheDocument();
      const patch = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
      ) as [string, RequestInit];
      expect(JSON.parse(patch[1].body as string)).toEqual({
        status: 'DISPONIBLE',
        comment: 'Localizada en físico, se consulta en sala',
      });
    });

    it('shows a reference without material as such once the request left En búsqueda', async () => {
      fetchMock.mockResolvedValue(
        ok(
          detail({
            status: 'DISPONIBLE',
            allowedTransitions: ['AGENDADA', 'CERRADA'],
            references: [{ ...pendingReference, displayStatus: 'SIN_MATERIAL' }],
          }),
        ),
      );

      const { section } = await open();

      expect(within(section).getByText('Sin material asociado')).toBeInTheDocument();
      expect(within(section).queryByText('Pendiente')).not.toBeInTheDocument();
      expect(within(section).queryByRole('note')).not.toBeInTheDocument();
    });

    it('offers no association once the request was rejected', async () => {
      fetchMock.mockResolvedValue(
        ok(
          detail({
            status: 'RECHAZADA',
            allowedTransitions: [],
            references: [{ ...pendingReference, displayStatus: 'SIN_MATERIAL' }],
          }),
        ),
      );

      const { section } = await open();

      expect(
        within(section).queryByRole('button', { name: /Asociar material/ }),
      ).not.toBeInTheDocument();
    });
  });
});
