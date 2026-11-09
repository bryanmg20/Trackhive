import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function tokenWithRole(role: string): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ sub: 'user-1', role }));
  return `${header}.${payload}.signature`;
}

function renderLoginPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<p>Pantalla de registro</p>} />
        <Route
          path="/solicitudes/nueva"
          element={<p>Pantalla de nueva solicitud</p>}
        />
        <Route path="/solicitudes" element={<p>Pantalla solicitudes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  email = 'ana@mail.com',
  password = 'secret123',
) {
  await user.type(screen.getByLabelText('Correo electrónico'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
}

describe('LoginPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('renders labelled email and password fields and the submit button', () => {
    renderLoginPage();

    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it('links to the registration screen', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('link', { name: /crear cuenta/i }));

    expect(screen.getByText('Pantalla de registro')).toBeInTheDocument();
  });

  it('shows required-field errors without calling the API', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await screen.findByText('Escriba su correo electrónico.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escriba su contraseña.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores the session and sends a public user to request creation', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        accessToken: tokenWithRole('PUBLICO'),
        refreshToken: 'refresh',
      }),
    );
    renderLoginPage();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await screen.findByText('Pantalla de nueva solicitud'),
    ).toBeInTheDocument();
    expect(localStorage.getItem('accessToken')).toBe(
      tokenWithRole('PUBLICO'),
    );
    expect(localStorage.getItem('refreshToken')).toBe('refresh');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'ana@mail.com', password: 'secret123' }),
      }),
    );
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'sends a %s user to staff requests',
    async (role) => {
      const user = userEvent.setup();
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          accessToken: tokenWithRole(role),
          refreshToken: 'refresh',
        }),
      );
      renderLoginPage();

      await fillForm(user);
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(
        await screen.findByText('Pantalla solicitudes'),
      ).toBeInTheDocument();
    },
  );

  it('shows invalid credentials and keeps the email on 401', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Correo o contraseña incorrectos',
      }),
    );
    renderLoginPage();

    await fillForm(user, 'ana@mail.com', 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos',
    );
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'ana@mail.com',
    );
  });

  it('shows a connection error when the server cannot be reached', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderLoginPage();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no pudimos conectar con el servidor/i,
    );
  });

  it('prefills the email after registration', () => {
    renderLoginPage({ registeredEmail: 'ana@mail.com' });

    expect(screen.getByRole('status')).toHaveTextContent('Cuenta creada');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'ana@mail.com',
    );
  });

  it('explains why a non-public user cannot open the request page', () => {
    renderLoginPage({ accessDenied: true });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Esta funcionalidad está disponible solo para cuentas públicas.',
    );
  });
});
