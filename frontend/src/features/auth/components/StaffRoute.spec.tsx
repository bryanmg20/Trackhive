import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { StaffRoute } from './StaffRoute';

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

function renderStaffRoute() {
  return render(
    <MemoryRouter initialEntries={['/personal/solicitudes/nueva']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route
            path="/personal/solicitudes/nueva"
            element={<h1>Ficha de solicitud</h1>}
          />
        </Route>
        <Route path="/materiales" element={<p>Pantalla de materiales</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StaffRoute', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it.each(['PERSONAL', 'ADMIN'])('allows %s to open the staff screen', (role) => {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));

    renderStaffRoute();

    expect(
      screen.getByRole('heading', { name: 'Ficha de solicitud' }),
    ).toBeInTheDocument();
  });

  it('sends a public user back to the material search', () => {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole('PUBLICO'));

    renderStaffRoute();

    expect(screen.getByText('Pantalla de materiales')).toBeInTheDocument();
  });

  it('sends a visitor without session to the login screen', () => {
    renderStaffRoute();

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
  });
});
