import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';

const fetchMock = vi.fn();

const validValues = {
  fullName: 'Ana Pérez',
  email: 'ana@mail.com',
  password: 'secret123',
  confirmPassword: 'secret123',
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function renderRegisterPage(redirectDelayMs = 4000) {
  return render(
    <MemoryRouter initialEntries={['/registro']}>
      <Routes>
        <Route
          path="/registro"
          element={<RegisterPage redirectDelayMs={redirectDelayMs} />}
        />
        <Route path="/login" element={<p>Pantalla de inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values = validValues,
  acceptPrivacy = true,
) {
  await user.type(screen.getByLabelText('Nombre completo'), values.fullName);
  await user.type(
    screen.getByLabelText('Correo electrónico'),
    values.email,
  );
  await user.type(screen.getByLabelText('Contraseña'), values.password);
  await user.type(
    screen.getByLabelText('Confirmar contraseña'),
    values.confirmPassword,
  );
  if (acceptPrivacy) {
    await user.click(
      screen.getByRole('checkbox', { name: /acepto el aviso de privacidad/i }),
    );
  }
}

describe('RegisterPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders a labelled field for every registration value', () => {
    renderRegisterPage();

    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Aviso de privacidad' }),
    ).toBeVisible();
    expect(screen.getByText(/Versión 1\.0/)).toBeVisible();
    expect(
      screen.getByRole('checkbox', {
        name: /acepto el aviso de privacidad/i,
      }),
    ).not.toBeChecked();
    expect(screen.getByText('Leer aviso completo')).toBeVisible();
    expect(screen.getByRole('link', { name: /ya tengo cuenta/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('shows per-field errors and keeps the typed values after an invalid submit', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Nombre completo'), 'A');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@mail');
    await user.type(screen.getByLabelText('Contraseña'), 'secret123');
    await user.type(
      screen.getByLabelText('Confirmar contraseña'),
      'secret123',
    );
    await user.click(
      screen.getByRole('checkbox', { name: /acepto el aviso de privacidad/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Escriba un correo válido.')).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('A');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@mail');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('secret123');
    expect(screen.getByLabelText('Confirmar contraseña')).toHaveValue(
      'secret123',
    );
  });

  it('blocks registration until the privacy notice is accepted and keeps the values', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(201, null));
    renderRegisterPage();

    await fillForm(user, validValues, false);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText(
        'Debe aceptar el aviso de privacidad para crear su cuenta.',
      ),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole('checkbox', {
        name: /acepto el aviso de privacidad/i,
      }),
    ).not.toBeChecked();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'ana@mail.com',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('secret123');

    await user.click(
      screen.getByRole('checkbox', { name: /acepto el aviso de privacidad/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByRole('heading', { name: 'Cuenta creada' }),
    ).toBeVisible();
  });

  it('reports mismatched passwords next to the confirmation field', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await fillForm(user, {
      ...validValues,
      confirmPassword: 'different123',
    });
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('Las contraseñas no coinciden.'),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Confirmar contraseña')).toHaveValue(
      'different123',
    );
  });

  it('maps API field details to the matching inputs without clearing them', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        code: 'VALIDATION_ERROR',
        message: 'La petición contiene datos inválidos',
        details: [
          { field: 'email', messages: ['El correo ya está registrado.'] },
        ],
      }),
    );
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('El correo ya está registrado.')).toBeVisible();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'ana@mail.com',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('secret123');
  });

  it('explains that the email is already registered on a conflict', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'El correo ya está registrado',
      }),
    );
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('Ya existe una cuenta con este correo. Inicie sesión.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'ana@mail.com',
    );
    expect(
      screen.getByRole('link', { name: /ya tengo cuenta/i }),
    ).toBeVisible();
  });

  it('shows a connection error when the API cannot be reached', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.',
    );
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'ana@mail.com',
    );
  });

  it('confirms the registration and navigates to login with the button', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(201, null));
    renderRegisterPage();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByRole('heading', { name: 'Cuenta creada' }),
    ).toBeVisible();
    expect(screen.getByText('ana@mail.com')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Ir a iniciar sesión' }),
    );

    expect(
      await screen.findByText('Pantalla de inicio de sesión'),
    ).toBeVisible();
  });

  it('redirects to login automatically after the confirmation delay', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(201, null));
    renderRegisterPage(50);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('Pantalla de inicio de sesión'),
    ).toBeVisible();
  });
});
