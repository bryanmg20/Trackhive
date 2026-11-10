import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRoute } from '../auth/components/StaffRoute';
import { AppointmentsCalendarPage } from './AppointmentsCalendarPage';

const fetchMock = vi.fn();

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
  const calls = fetchMock.mock.calls;
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
    vi.stubGlobal('fetch', fetchMock);
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
    expect(
      within(detailSection).getByText('CC 123456789'),
    ).toBeInTheDocument();
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
    fetchMock.mockResolvedValue(page([appointmentItem()], 45));
    renderPage('PERSONAL');
    await screen.findByText('Página 1 de 3');

    await user.selectOptions(
      screen.getByLabelText('Ordenar por'),
      'createdAt',
    );
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
});
