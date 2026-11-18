import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRoute } from '../auth/components/StaffRoute';
import { AppointmentsCalendarPage } from './AppointmentsCalendarPage';

const fetchMock = vi.fn();
const occupancyMock = vi.fn();

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function appointmentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    date: '2026-11-20',
    serviceHours: { opensAt: '08:00', closesAt: '17:00' },
    status: 'PROGRAMADA',
    notes: 'Revisión de actas originales en sala',
    createdAt: '2026-11-10T15:00:00.000Z',
    request: {
      id: '00000000-0000-4000-8000-000000000001',
      trackingCode: 'SOL-2026-00001',
      status: 'AGENDADA',
      deliveryMode: 'PRESENCIAL',
    },
    requester: {
      id: 'requester-1',
      name: 'Juan Carlos Pérez',
      email: 'juan@mail.com',
      phone: '3001234567',
      requesterType: 'INVESTIGADOR',
      institution: 'Universidad del Norte',
      documentType: 'CC',
      documentNumber: '123456789',
    },
    scheduledBy: {
      id: 'staff-1',
      name: 'Ana Gómez',
    },
    materials: [
      {
        id: 'material-1',
        catalogCode: 'TH-DOC-0001',
        title: 'Acta de fundación de la villa',
        materialType: 'DOCUMENTO',
        location: {
          depot: 'D-01',
          shelf: 'E-01',
          box: 'C-001',
        },
      },
    ],
    ...overrides,
  };
}

function page(items: unknown[], total = items.length, pageNumber = 1) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, page: pageNumber, limit: 20, total }),
  };
}

function lastUrl(): URL {
  // Monthly data is loaded independently of the existing paginated listing.
  const calls = fetchMock.mock.calls.filter(
    ([url]) =>
      new URL(url as string, 'http://localhost').searchParams.get('limit') ===
      '20',
  );
  return new URL(calls[calls.length - 1][0] as string, 'http://localhost');
}

function renderPage(role?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }
  return render(
    <MemoryRouter initialEntries={['/calendario']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/calendario" element={<AppointmentsCalendarPage />} />
        </Route>
        <Route path="/materiales" element={<p>Pantalla de búsqueda</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppointmentsCalendarPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    occupancyMock.mockReset();
    occupancyMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        dailyCapacity: 15,
        days: [
          {
            date: '2026-11-20',
            occupied: 3,
            available: 12,
            isFull: false,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      url.includes('/appointments/occupancy')
        ? occupancyMock(url, init)
        : fetchMock(url, init),
    );
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'shows each appointment on its date with its status and material for %s',
    async (role) => {
      fetchMock.mockResolvedValue(
        page([
          appointmentItem(),
          appointmentItem({
            id: '00000000-0000-4000-8000-000000000011',
            date: '2026-11-12',
            status: 'CUMPLIDA',
            materials: [
              {
                id: 'material-2',
                catalogCode: 'TH-DOC-0008',
                title: 'Informe de obras públicas',
                materialType: 'DOCUMENTO',
                location: { depot: 'D-02', shelf: 'E-01', box: 'C-030' },
              },
            ],
          }),
        ]),
      );

      renderPage(role);

      const calendar = await screen.findByRole('region', {
        name: /calendario de noviembre de 2026/i,
      });
      const day20 = calendar.querySelector('[data-date="2026-11-20"]');
      const day12 = calendar.querySelector('[data-date="2026-11-12"]');
      expect(day20).not.toBeNull();
      expect(day12).not.toBeNull();

      expect(
        within(day20 as HTMLElement).getByText('Acta de fundación de la villa'),
      ).toBeInTheDocument();
      expect(
        within(day20 as HTMLElement).getByText('Programada'),
      ).toBeInTheDocument();

      expect(
        within(day12 as HTMLElement).getByText('Informe de obras públicas'),
      ).toBeInTheDocument();
      expect(
        within(day12 as HTMLElement).getByText('Cumplida'),
      ).toBeInTheDocument();
      expect(screen.getByText('2 citas')).toBeInTheDocument();
    },
  );

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

  it('shows the appointment detail when an appointment in the calendar is selected', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([appointmentItem()]));
    renderPage('PERSONAL');

    const button = await screen.findByRole('button', {
      name: /acta de fundación de la villa/i,
    });
    expect(
      screen.queryByRole('heading', { name: /detalle de la cita/i }),
    ).not.toBeInTheDocument();

    await user.click(button);

    const detailSection = await screen.findByRole('region', {
      name: /detalle de la cita · SOL-2026-00001/i,
    });
    expect(
      within(detailSection).getByText('viernes 20/11/2026'),
    ).toBeInTheDocument();
    expect(
      within(detailSection).getByText('De 8:00 a 17:00'),
    ).toBeInTheDocument();
    expect(
      within(detailSection).getByText('Juan Carlos Pérez'),
    ).toBeInTheDocument();
    expect(
      within(detailSection).getByText('juan@mail.com'),
    ).toBeInTheDocument();
    expect(
      within(detailSection).getByText('Universidad del Norte'),
    ).toBeInTheDocument();
    expect(within(detailSection).getByText('CC 123456789')).toBeInTheDocument();
    expect(within(detailSection).getByText('Ana Gómez')).toBeInTheDocument();
    expect(
      within(detailSection).getByText('Ubicación: D-01 · E-01 · C-001'),
    ).toBeInTheDocument();
    expect(
      within(detailSection).getByRole('link', {
        name: /ver solicitud completa/i,
      }),
    ).toHaveAttribute(
      'href',
      '/solicitudes/00000000-0000-4000-8000-000000000001',
    );
  });

  it('filters by material and requester', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([appointmentItem()]));
    renderPage('PERSONAL');
    await screen.findByText('1 citas');

    await user.type(screen.getByLabelText('Material'), 'cabildo');
    await user.type(screen.getByLabelText('Solicitante'), 'juan pérez{Enter}');

    await waitFor(() => {
      const { searchParams } = lastUrl();
      expect(searchParams.get('material')).toBe('cabildo');
      expect(searchParams.get('requester')).toBe('juan pérez');
      expect(searchParams.get('page')).toBe('1');
    });
  });

  it('filters by status and date range, and clears filters', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([appointmentItem()]));
    renderPage('PERSONAL');
    await screen.findByText('1 citas');

    await user.click(screen.getByRole('radio', { name: 'Programada' }));
    await user.type(screen.getByLabelText('Fecha desde'), '2026-11-01');
    await user.type(screen.getByLabelText('Fecha hasta'), '2026-11-30');

    await waitFor(() => {
      const { searchParams } = lastUrl();
      expect(searchParams.get('status')).toBe('PROGRAMADA');
      expect(searchParams.get('from')).toBe('2026-11-01');
      expect(searchParams.get('to')).toBe('2026-11-30');
    });

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));

    await waitFor(() => {
      const { searchParams } = lastUrl();
      expect(searchParams.has('status')).toBe(false);
      expect(searchParams.has('from')).toBe(false);
      expect(searchParams.has('to')).toBe(false);
    });
  });

  it('supports sorting and pagination', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        page(
          [appointmentItem()],
          new URL(url, 'http://localhost').searchParams.get('limit') === '20'
            ? 45
            : 1,
        ),
      ),
    );
    renderPage('PERSONAL');
    await screen.findByText('Página 1 de 3');

    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'createdAt');
    await user.selectOptions(screen.getByLabelText('Dirección'), 'desc');

    await waitFor(() => {
      expect(lastUrl().searchParams.get('sort')).toBe('createdAt');
      expect(lastUrl().searchParams.get('order')).toBe('desc');
    });

    const pagination = screen.getByRole('navigation', { name: 'Paginación' });
    await user.click(
      within(pagination).getByRole('button', { name: /siguiente/i }),
    );
    await waitFor(() => expect(lastUrl().searchParams.get('page')).toBe('2'));
  });

  it('navigates between months in the calendar', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(page([appointmentItem()]));
    renderPage('PERSONAL');
    await screen.findByRole('region', {
      name: /calendario de noviembre de 2026/i,
    });

    await user.click(screen.getByRole('button', { name: /mes siguiente/i }));
    expect(
      screen.getByRole('region', { name: /calendario de diciembre de 2026/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mes anterior/i }));
    expect(
      screen.getByRole('region', { name: /calendario de noviembre de 2026/i }),
    ).toBeInTheDocument();
  });

  it('shows daily capacity badge and per-day occupancy count on the calendar', async () => {
    occupancyMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        dailyCapacity: 20,
        days: [
          {
            date: '2026-11-20',
            occupied: 3,
            available: 17,
            isFull: false,
          },
        ],
      }),
    });
    fetchMock.mockResolvedValue(page([appointmentItem()]));
    renderPage('PERSONAL');

    expect(
      await screen.findByText('Capacidad diaria: 20 citas'),
    ).toBeInTheDocument();
    const calendar = await screen.findByRole('region', {
      name: /calendario de noviembre de 2026/i,
    });
    const day20 = calendar.querySelector('[data-date="2026-11-20"]');
    expect(day20).not.toBeNull();
    expect(within(day20 as HTMLElement).getByText('3/20')).toBeInTheDocument();
    expect(
      screen.getByText(/cerca del límite desde 16 citas/i),
    ).toBeInTheDocument();
  });

  it('announces near and full capacity and labels the complete daily list', async () => {
    const items = Array.from({ length: 27 }, (_, index) =>
      appointmentItem({
        id: `appointment-${index}`,
        date: index < 15 ? '2026-11-20' : '2026-11-21',
      }),
    );
    fetchMock.mockResolvedValue(page(items));
    renderPage('PERSONAL');
    const calendar = await screen.findByRole('region', {
      name: /calendario de noviembre de 2026/i,
    });
    expect(
      within(calendar).getByLabelText(
        /viernes 20\/11\/2026: ocupación 15 de 15, capacidad alcanzada/,
      ),
    ).toBeInTheDocument();
    expect(
      within(calendar).getByLabelText(
        /sábado 21\/11\/2026: ocupación 12 de 15, cerca del límite/,
      ),
    ).toBeInTheDocument();
    expect(
      within(calendar).getByRole('button', {
        name: /ver las 15 citas del viernes 20\/11\/2026; 12 más/i,
      }),
    ).toHaveTextContent('+12 más');
  });

  it('reports an incomplete monthly load and allows retrying instead of showing partial occupancy', async () => {
    const user = userEvent.setup();
    let fail = true;
    fetchMock.mockImplementation((url: string) => {
      if (
        new URL(url, 'http://localhost').searchParams.get('limit') === '100' &&
        fail
      ) {
        return Promise.reject(new Error('Network unavailable'));
      }
      return Promise.resolve(page([appointmentItem()]));
    });
    renderPage('PERSONAL');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar la agenda completa',
    );
    expect(
      screen.queryByRole('region', { name: /calendario de noviembre/i }),
    ).not.toBeInTheDocument();
    fail = false;
    await user.click(
      screen.getByRole('button', { name: 'Reintentar cargar agenda' }),
    );
    expect(
      await screen.findByRole('region', { name: /calendario de noviembre/i }),
    ).toBeInTheDocument();
  });

  it('lets staff reschedule a selected appointment from the calendar (HU-21)', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && url.includes('/reschedule')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: '00000000-0000-4000-8000-000000000001',
            status: 'AGENDADA',
            allowedTransitions: ['DISPONIBLE', 'ATENDIDA'],
            appointment: {
              id: '00000000-0000-4000-8000-000000000010',
              date: '2026-11-24',
              serviceHours: { opensAt: '08:00', closesAt: '17:00' },
              status: 'PROGRAMADA',
              requester: { id: 'requester-1', name: 'Juan Carlos Pérez' },
              materials: [],
            },
            statusChange: {
              previousStatus: 'AGENDADA',
              newStatus: 'AGENDADA',
              changedAt: '2026-11-18T15:00:00.000Z',
              changedBy: { id: 'staff-1', name: 'Ana Gómez' },
              comment: 'Cita reprogramada del 2026-11-20 al 2026-11-24',
            },
          }),
        });
      }
      return Promise.resolve(page([appointmentItem()]));
    });

    renderPage('PERSONAL');

    const appointmentButton = await screen.findByRole('button', {
      name: /acta de fundación de la villa/i,
    });
    await user.click(appointmentButton);

    const detailSection = await screen.findByRole('region', {
      name: /detalle de la cita · SOL-2026-00001/i,
    });
    await user.type(
      within(detailSection).getByLabelText('Nueva fecha de la cita'),
      '2026-11-24',
    );
    await user.click(
      within(detailSection).getByRole('button', { name: 'Reprogramar cita' }),
    );

    expect(await within(detailSection).findByRole('status')).toHaveTextContent(
      /cita reprogramada para el martes 24\/11\/2026/i,
    );
    expect(
      within(detailSection).getByText('martes 24/11/2026'),
    ).toBeInTheDocument();
  });

  it('shows the availability conflict error on the calendar screen when rescheduling fails (HU-21)', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && url.includes('/reschedule')) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            statusCode: 409,
            code: 'MATERIAL_ALREADY_BOOKED',
            message:
              'El material «Acta de fundación de la villa» (TH-DOC-0001) ya tiene cita el martes, 24 de noviembre de 2026 (solicitud SOL-2026-00008).',
          }),
        });
      }
      return Promise.resolve(page([appointmentItem()]));
    });

    renderPage('PERSONAL');

    const appointmentButton = await screen.findByRole('button', {
      name: /acta de fundación de la villa/i,
    });
    await user.click(appointmentButton);

    const detailSection = await screen.findByRole('region', {
      name: /detalle de la cita · SOL-2026-00001/i,
    });
    await user.type(
      within(detailSection).getByLabelText('Nueva fecha de la cita'),
      '2026-11-24',
    );
    await user.click(
      within(detailSection).getByRole('button', { name: 'Reprogramar cita' }),
    );

    expect(await within(detailSection).findByRole('alert')).toHaveTextContent(
      /ya tiene cita el martes, 24 de noviembre de 2026/i,
    );
  });

  it('lets staff cancel a selected appointment from the calendar and updates its status (HU-21)', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && url.includes('/cancel')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: '00000000-0000-4000-8000-000000000001',
            status: 'DISPONIBLE',
            allowedTransitions: ['AGENDADA', 'CERRADA'],
            appointment: {
              id: '00000000-0000-4000-8000-000000000010',
              date: '2026-11-20',
              status: 'CANCELADA',
            },
            statusChange: {
              previousStatus: 'AGENDADA',
              newStatus: 'DISPONIBLE',
              changedAt: '2026-11-18T15:00:00.000Z',
              changedBy: { id: 'staff-1', name: 'Ana Gómez' },
              comment: 'Cita del 2026-11-20 cancelada',
            },
          }),
        });
      }
      return Promise.resolve(page([appointmentItem()]));
    });

    renderPage('PERSONAL');

    const appointmentButton = await screen.findByRole('button', {
      name: /acta de fundación de la villa/i,
    });
    await user.click(appointmentButton);

    const detailSection = await screen.findByRole('region', {
      name: /detalle de la cita · SOL-2026-00001/i,
    });
    await user.click(
      within(detailSection).getByRole('button', { name: 'Cancelar cita' }),
    );

    expect(await within(detailSection).findByRole('status')).toHaveTextContent(
      /cita cancelada\. el material quedó libre, la solicitud volvió a disponible/i,
    );
    expect(within(detailSection).getByText('Cancelada')).toBeInTheDocument();
    expect(within(detailSection).getByText('Disponible')).toBeInTheDocument();
  });
});
