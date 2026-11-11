import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteNav } from './SiteNav';

function tokenWithRole(role: string, expiresInSeconds = 60): string {
  const payload = btoa(
    JSON.stringify({
      role,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
  );
  return `header.${payload}.signature`;
}

function renderNav() {
  return render(
    <MemoryRouter>
      <SiteNav />
    </MemoryRouter>,
  );
}

describe('SiteNav', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('shows only the public sections to a PUBLICO account', () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      tokenWithRole('PUBLICO'),
    );

    renderNav();

    expect(
      screen.getByRole('link', { name: 'Buscar material' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Mis solicitudes' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Nueva solicitud' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Solicitudes' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Calendario' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Material' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Registrar solicitud' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
  });

  it.each(['PUBLICO', 'PERSONAL', 'ADMIN'])(
    'never offers the new request option to %s',
    (role) => {
      sessionStorage.setItem(
        'trackhive.accessToken',
        tokenWithRole(role),
      );

      renderNav();

      expect(
        screen.queryByRole('link', { name: 'Nueva solicitud' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(['PERSONAL', 'ADMIN'])(
    'shows the staff sections to %s',
    (role) => {
      sessionStorage.setItem(
        'trackhive.accessToken',
        tokenWithRole(role),
      );

      renderNav();

      expect(
        screen.getByRole('link', { name: 'Solicitudes' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Calendario' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Material' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Registrar solicitud' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Buscar material' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Nueva solicitud' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Mis solicitudes' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Cerrar sesión' }),
      ).toBeInTheDocument();
    },
  );

  it('keeps the role when the access token is expired so it can be renewed', () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      tokenWithRole('PERSONAL', -60),
    );

    renderNav();

    expect(
      screen.getByRole('link', { name: 'Solicitudes' }),
    ).toBeInTheDocument();
  });

  it('shows no menu to a visitor without a session', () => {
    renderNav();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cerrar sesión' }),
    ).not.toBeInTheDocument();
  });

  it('closes the session and returns to the login screen', async () => {
    sessionStorage.setItem(
      'trackhive.accessToken',
      tokenWithRole('PUBLICO'),
    );
    sessionStorage.setItem('trackhive.refreshToken', 'refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ status: 204 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/materiales']}>
        <Routes>
          <Route path="/materiales" element={<SiteNav />} />
          <Route path="/login" element={<p>Iniciar sesión</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    );

    expect(await screen.findByText('Iniciar sesión')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(
      sessionStorage.getItem('trackhive.refreshToken'),
    ).toBeNull();
  });
});
