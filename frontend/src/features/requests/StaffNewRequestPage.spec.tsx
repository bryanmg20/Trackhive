import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffNewRequestPage } from './StaffNewRequestPage';

const fetchMock = vi.fn();

const MATERIAL = {
  id: 'c1b438db-f082-466f-9535-ec2e0ff2de1f',
  catalogCode: 'TH-DOC-0001',
  title: 'Acta de fundación de la villa',
};

const FOUND_PROFILE = {
  requesterId: 'requester-1',
  userId: 'user-1',
  firstName: 'Ana',
  middleName: 'María',
  lastName: 'Pérez',
  secondLastName: 'Gómez',
  email: 'ana@example.com',
  phone: '3001234567',
  requesterType: 'INVESTIGADOR',
  institution: 'Universidad del Norte',
  documentType: 'CC',
  documentNumber: '1234567890',
  foundIn: 'USER',
};

const CREATED = {
  id: 'request-1',
  trackingCode: 'SOL-2026-00001',
  status: 'RECIBIDA',
};

function ok(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body };
}

function fail(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

function renderPage(
  search = `?materiales=${MATERIAL.id}`,
  state?: unknown,
): ReactElement {
  return (
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/personal/solicitudes/nueva',
          search,
          state,
        },
      ]}
    >
      <Routes>
        <Route
          path="/personal/solicitudes/nueva"
          element={<StaffNewRequestPage />}
        />
        <Route path="/personal/materiales" element={<p>Estado del material</p>} />
        <Route path="/materiales" element={<p>Buscador de material</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function lookUp(
  user: ReturnType<typeof userEvent.setup>,
  email = 'ana@example.com',
) {
  await user.type(screen.getByLabelText(/Correo del solicitante/), email);
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
}

async function fillRequest(
  user: ReturnType<typeof userEvent.setup>,
  reason = 'Consulta para una investigación histórica',
  date = '2026-12-15',
) {
  await user.type(screen.getByLabelText(/Motivo de la consulta/), reason);
  fireEvent.change(screen.getByLabelText(/Fecha deseada/), {
    target: { value: date },
  });
}

describe('StaffNewRequestPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      'trackhive.accessToken',
      `header.${btoa(JSON.stringify({ role: 'PERSONAL', exp: Math.floor(Date.now() / 1000) + 60 }))}.signature`,
    );
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('does not include its own material search', () => {
    render(renderPage());

    expect(screen.getByRole('heading', { name: 'Ficha de solicitud' })).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Buscar en el archivo'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Título, autor o código'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cambiar materiales' })).toHaveAttribute(
      'href',
      '/personal/materiales',
    );
  });

  it('shows the materials that arrive from the search screen', () => {
    render(renderPage(`?materiales=${MATERIAL.id}`, { materials: [MATERIAL] }));

    expect(screen.getByText(MATERIAL.title)).toBeInTheDocument();
    expect(screen.getByText(MATERIAL.catalogCode)).toBeInTheDocument();
  });

  it('shows the registered requester data and does not ask for contact fields', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(ok(FOUND_PROFILE));
    render(renderPage());

    await lookUp(user);

    expect(await screen.findByText('Encontrado')).toBeInTheDocument();
    expect(screen.getByText('Ana María Pérez Gómez')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Primer nombre/),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Primer apellido/)).not.toBeInTheDocument();
  });

  it('asks for contact data when the email is not registered', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(fail(404, { code: 'REQUESTER_NOT_FOUND' }));
    render(renderPage());

    await lookUp(user, 'nuevo@example.com');

    expect(await screen.findByText('Nuevo solicitante')).toBeInTheDocument();
    expect(screen.getByLabelText(/Primer nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Primer apellido/)).toBeInTheDocument();
  });

  it('submits the request with the found requester email and userId', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(ok(FOUND_PROFILE))
      .mockResolvedValueOnce(ok(CREATED, 201));
    render(renderPage());

    await lookUp(user);
    await screen.findByText('Encontrado');
    await fillRequest(user);
    await user.click(screen.getByRole('button', { name: 'Registrar solicitud' }));

    await screen.findByText(CREATED.trackingCode);
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      materialIds: [MATERIAL.id],
      reason: 'Consulta para una investigación histórica',
      desiredDate: '2026-12-15',
      deliveryMode: 'PRESENCIAL',
      requester: { email: 'ana@example.com', userId: 'user-1' },
    });
  });

  it('submits the contact data of a new requester', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(fail(404, { code: 'REQUESTER_NOT_FOUND' }))
      .mockResolvedValueOnce(ok(CREATED, 201));
    render(renderPage());

    await lookUp(user, 'nuevo@example.com');
    await screen.findByText('Nuevo solicitante');
    await user.type(screen.getByLabelText(/Primer nombre/), 'Luis');
    await user.type(screen.getByLabelText(/Primer apellido/), 'Rojas');
    await user.type(screen.getByLabelText('Teléfono de contacto'), '3000000000');
    await fillRequest(user);
    await user.click(screen.getByRole('button', { name: 'Registrar solicitud' }));

    await screen.findByText(CREATED.trackingCode);
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.requester).toMatchObject({
      email: 'nuevo@example.com',
      firstName: 'Luis',
      lastName: 'Rojas',
      phone: '3000000000',
      requesterType: 'CIUDADANO',
    });
    expect(body.requester.userId).toBeUndefined();
  });

  it('shows the backend date error next to the date field', async () => {
    const user = userEvent.setup();
    const message =
      'La fecha deseada debe tener al menos 10 días hábiles de anticipación.';
    fetchMock
      .mockResolvedValueOnce(ok(FOUND_PROFILE))
      .mockResolvedValueOnce(
        fail(400, { code: 'INVALID_DESIRED_DATE', message }),
      );
    render(renderPage());

    await lookUp(user);
    await screen.findByText('Encontrado');
    await fillRequest(user, undefined, '2026-11-15');
    await user.click(screen.getByRole('button', { name: 'Registrar solicitud' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    const dateInput = screen.getByLabelText(/Fecha deseada/);
    expect(dateInput).toHaveAttribute('aria-invalid', 'true');
    expect(dateInput).toHaveAttribute(
      'aria-describedby',
      'staff-request-date-error',
    );
  });

  it('shows a validation detail next to the matching contact field', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(fail(404, { code: 'REQUESTER_NOT_FOUND' }))
      .mockResolvedValueOnce(
        fail(400, {
          code: 'VALIDATION_ERROR',
          message: 'La petición contiene datos inválidos',
          details: [
            {
              field: 'requester.firstName',
              messages: ['El nombre solo admite letras.'],
            },
          ],
        }),
      );
    render(renderPage());

    await lookUp(user, 'nuevo@example.com');
    await screen.findByText('Nuevo solicitante');
    await user.type(screen.getByLabelText(/Primer nombre/), 'Luis1');
    await user.type(screen.getByLabelText(/Primer apellido/), 'Rojas');
    await fillRequest(user);
    await user.click(screen.getByRole('button', { name: 'Registrar solicitud' }));

    expect(
      await screen.findByText('El nombre solo admite letras.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Primer nombre/)).toHaveAttribute(
      'aria-describedby',
      'requester-first-name-error',
    );
  });

  it('shows the tracking code after a valid submission', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(ok(FOUND_PROFILE))
      .mockResolvedValueOnce(ok(CREATED, 201));
    render(renderPage());

    await lookUp(user);
    await screen.findByText('Encontrado');
    await fillRequest(user);
    await user.click(screen.getByRole('button', { name: 'Registrar solicitud' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      CREATED.trackingCode,
    );
    expect(
      screen.getByRole('heading', { name: 'Solicitud registrada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana María Pérez Gómez')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Buscar otro material' }),
    ).toHaveAttribute('href', '/personal/materiales');
  });

  it('asks to sign in again when the session expires', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(ok(FOUND_PROFILE))
      .mockResolvedValueOnce(
        fail(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' }),
      );
    render(renderPage());

    await lookUp(user);
    await screen.findByText('Encontrado');
    await fillRequest(user);
    await user.click(screen.getByRole('button', { name: 'Registrar solicitud' }));

    expect(
      await screen.findByText(
        'Su sesión no es válida o venció. Inicie sesión de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });
});
