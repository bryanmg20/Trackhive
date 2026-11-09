import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('allows an active PUBLICO token to open the protected route', () => {
    localStorage.setItem('accessToken', tokenWithRole('PUBLICO'));

    render(
      <MemoryRouter initialEntries={['/solicitudes/nueva']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route
              path="/solicitudes/nueva"
              element={<h1>Radicar solicitud</h1>}
            />
          </Route>
          <Route path="/login" element={<h1>Iniciar sesión</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Radicar solicitud' }),
    ).toBeInTheDocument();
  });

  it('redirects a PERSONAL token to login', () => {
    localStorage.setItem('accessToken', tokenWithRole('PERSONAL'));

    render(
      <MemoryRouter initialEntries={['/solicitudes/nueva']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route
              path="/solicitudes/nueva"
              element={<h1>Radicar solicitud</h1>}
            />
          </Route>
          <Route path="/login" element={<h1>Iniciar sesión</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });
});
