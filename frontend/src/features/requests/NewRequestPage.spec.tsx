import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewRequestPage } from './NewRequestPage';

const fetchMock = vi.fn();

const MATERIAL = {
  id: 'c1b438db-f082-466f-9535-ec2e0ff2de1f',
  catalogCode: 'TH-DOC-0001',
  title: 'Acta de fundación de la villa',
};

function renderPage(entry: string | { pathname: string; search: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/solicitudes/nueva" element={<NewRequestPage />} />
        <Route path="/materiales" element={<p>Pantalla buscar material</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NewRequestPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('has no material search of its own', () => {
    renderPage(`/solicitudes/nueva?materiales=${MATERIAL.id}`);

    expect(screen.queryByLabelText('Buscar en el archivo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument();
  });

  it('shows the materials chosen in the search screen', () => {
    renderPage({
      pathname: '/solicitudes/nueva',
      search: `?materiales=${MATERIAL.id}`,
      state: { materials: [MATERIAL] },
    });

    expect(
      screen.getByRole('heading', { name: 'Materiales seleccionados: 1' }),
    ).toBeInTheDocument();
    expect(screen.getByText(MATERIAL.title)).toBeInTheDocument();
  });

  it('offers to go back to the search when no materials arrive', async () => {
    const user = userEvent.setup();
    renderPage('/solicitudes/nueva');

    expect(
      screen.queryByRole('button', { name: 'Enviar solicitud' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('link', { name: 'Ir al buscador de material' }),
    );
    expect(screen.getByText('Pantalla buscar material')).toBeInTheDocument();
  });

  it('sends the material IDs from the URL', async () => {
    const user = userEvent.setup();
    const otherId = '0b6f5d1e-3a2c-4e8f-9d7b-2c1a0e9f8d7c';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'request-1',
        trackingCode: 'SOL-2026-00001',
        status: 'RECIBIDA',
      }),
    });
    renderPage(`/solicitudes/nueva?materiales=${MATERIAL.id},${otherId}`);

    await user.type(
      screen.getByLabelText('Motivo de la consulta'),
      'Consulta para investigación',
    );
    fireEvent.change(screen.getByLabelText('Fecha deseada'), {
      target: { value: '2026-11-23' },
    });
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'SOL-2026-00001',
    );
    expect(
      screen.getByRole('link', { name: 'Ver mis solicitudes' }),
    ).toHaveAttribute('href', '/mis-solicitudes');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/requests');
    expect(JSON.parse(init.body as string)).toMatchObject({
      materialIds: [MATERIAL.id, otherId],
    });
  });

  it('clears a previous tracking code when a later submission fails', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'request-1',
          trackingCode: 'SOL-2026-00001',
          status: 'RECIBIDA',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'La fecha deseada no es válida.' }),
      });
    renderPage(`/solicitudes/nueva?materiales=${MATERIAL.id}`);

    await user.type(
      screen.getByLabelText('Motivo de la consulta'),
      'Consulta para investigación',
    );
    fireEvent.change(screen.getByLabelText('Fecha deseada'), {
      target: { value: '2026-11-23' },
    });
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'SOL-2026-00001',
    );

    fireEvent.change(screen.getByLabelText('Fecha deseada'), {
      target: { value: '2026-11-22' },
    });
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La fecha deseada no es válida.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
