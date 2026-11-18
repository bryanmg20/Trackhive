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

function renderGuarded(role?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }
  return render(
    <MemoryRouter initialEntries={['/admin/capacidad-sala']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/capacidad-sala" element={<p>Capacidad sala</p>} />
        </Route>
        <Route path="/solicitudes" element={<p>Bandeja de personal</p>} />
        <Route path="/materiales" element={<p>Búsqueda pública</p>} />
        <Route path="/login" element={<p>Inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lets ADMIN open the admin screen', () => {
    renderGuarded('ADMIN');

    expect(screen.getByText('Capacidad sala')).toBeInTheDocument();
  });

  it('redirects PERSONAL to staff requests', () => {
    renderGuarded('PERSONAL');

    expect(screen.getByText('Bandeja de personal')).toBeInTheDocument();
  });

  it('redirects PUBLICO to public materials search', () => {
    renderGuarded('PUBLICO');

    expect(screen.getByText('Búsqueda pública')).toBeInTheDocument();
  });

  it('redirects unauthenticated visitors to login', () => {
    renderGuarded();

    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument();
  });
});
