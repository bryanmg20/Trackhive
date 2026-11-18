import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRoute } from '../auth/components/AdminRoute';
import { RoomCapacityPage } from './RoomCapacityPage';

const fetchMock = vi.fn();

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function renderPage(role?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }
  return render(
    <MemoryRouter initialEntries={['/admin/capacidad-sala']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/capacidad-sala" element={<RoomCapacityPage />} />
        </Route>
        <Route path="/solicitudes" element={<p>Bandeja de personal</p>} />
        <Route path="/materiales" element={<p>Pantalla pública</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoomCapacityPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the default capacity (15) and lets ADMIN save a new positive integer', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dailyCapacity: 15,
          isDefault: true,
          updatedAt: null,
          updatedBy: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dailyCapacity: 24,
          isDefault: false,
          updatedAt: '2026-11-18T03:00:00.000Z',
          updatedBy: { id: 'admin-1', name: 'Admin Demo' },
        }),
      });

    renderPage('ADMIN');

    expect(await screen.findByText('15 citas / día')).toBeInTheDocument();
    expect(
      screen.getByText(/Valor por defecto \(sin configuración personalizada\)/),
    ).toBeInTheDocument();

    const input = screen.getByLabelText('Capacidad diaria (entero mayor que 0)');
    expect(input).toHaveValue(15);

    await user.clear(input);
    await user.type(input, '24');
    await user.click(screen.getByRole('button', { name: 'Guardar capacidad' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Capacidad diaria actualizada a 24 citas por día.',
    );
    expect(screen.getByText('24 citas / día')).toBeInTheDocument();
    expect(screen.getByText(/por Admin Demo/)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/appointments/capacity',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ dailyCapacity: 24 }),
      }),
    );
  });

  it('validates non-positive or non-integer values without calling the API', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        dailyCapacity: 15,
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      }),
    });

    renderPage('ADMIN');
    const input = await screen.findByLabelText(
      'Capacidad diaria (entero mayor que 0)',
    );

    await user.clear(input);
    await user.type(input, '0');
    await user.click(screen.getByRole('button', { name: 'Guardar capacidad' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingrese un número entero mayor que 0.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the typed value and displays server error when saving fails with 403', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          dailyCapacity: 15,
          isDefault: true,
          updatedAt: null,
          updatedBy: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Prohibido' }),
      });

    renderPage('ADMIN');
    const input = await screen.findByLabelText(
      'Capacidad diaria (entero mayor que 0)',
    );

    await user.clear(input);
    await user.type(input, '30');
    await user.click(screen.getByRole('button', { name: 'Guardar capacidad' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo un administrador puede configurar la capacidad de la sala.',
    );
    await waitFor(() => expect(input).toHaveValue(30));
  });

  it('blocks PERSONAL and PUBLICO users via AdminRoute', () => {
    renderPage('PERSONAL');
    expect(screen.getByText('Bandeja de personal')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
