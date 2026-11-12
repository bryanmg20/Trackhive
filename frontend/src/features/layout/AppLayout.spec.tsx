import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppLayout } from './AppLayout';

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({
      role,
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  );
  return `header.${payload}.signature`;
}

function renderLayout(role: string | null, footer?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }

  return render(
    <MemoryRouter>
      <AppLayout footer={footer ? <p>{footer}</p> : undefined}>
        <h1>Contenido</h1>
      </AppLayout>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders the screen content inside the main region', () => {
    renderLayout('PUBLICO');

    const main = screen.getByRole('main');

    expect(main).toContainElement(
      screen.getByRole('heading', { name: 'Contenido' }),
    );
  });

  it('shows the archive tag and menu to a public account', () => {
    renderLayout('PUBLICO');

    expect(screen.getByText('CLENA · Archivo')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Secciones' }),
    ).toBeInTheDocument();
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'shows the staff tag and menu to %s',
    (role) => {
      renderLayout(role);

      expect(screen.getByText('CLENA · Personal')).toBeInTheDocument();
      expect(
        screen.getByRole('navigation', { name: 'Secciones' }),
      ).toBeInTheDocument();
    },
  );

  it('renders the optional footer outside the main region', () => {
    renderLayout('PUBLICO', 'Barra de solicitud');

    const footer = screen.getByText('Barra de solicitud');

    expect(footer).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toContainElement(footer);
  });

  it('keeps the brand for a visitor without a session and hides the menu', () => {
    renderLayout(null);

    expect(screen.getByText('CLENA · Archivo')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
