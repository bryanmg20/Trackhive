import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminRoute } from './AdminRoute';

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin/usuarios']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/usuarios" element={<h1>Usuarios</h1>} />
        </Route>
        <Route path="/solicitudes" element={<p>Bandeja del personal</p>} />
        <Route path="/materiales" element={<p>Pantalla de materiales</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lets an ADMIN open the screen', () => {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole('ADMIN'));

    renderAdminRoute();

    expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it('sends PERSONAL back to the requests inbox', () => {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole('PERSONAL'));

    renderAdminRoute();

    expect(screen.getByText('Bandeja del personal')).toBeInTheDocument();
  });

  it('sends a public user back to the material search', () => {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole('PUBLICO'));

    renderAdminRoute();

    expect(screen.getByText('Pantalla de materiales')).toBeInTheDocument();
  });

  it('sends a visitor without session to the login screen', () => {
    renderAdminRoute();

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
  });
});
