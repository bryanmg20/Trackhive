import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffRoute } from '../auth/components/StaffRoute';
import { StaffMaterialsPage } from './StaffMaterialsPage';

const fetchMock = vi.fn();

function tokenWithRole(role: string): string {
  const payload = btoa(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 60 }),
  );
  return `header.${payload}.signature`;
}

const MATERIAL_ID = '00000000-0000-4000-8000-000000000001';

function material(overrides: Record<string, unknown> = {}) {
  return {
    id: MATERIAL_ID,
    catalogCode: 'TH-DOC-0001',
    title: 'Acta 1',
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Actas del Cabildo',
    publicationDate: null,
    publisher: null,
    status: 'DISPONIBLE',
    ...overrides,
  };
}

function listResponse(items: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, page: 1, limit: 10, total: items.length }),
  };
}

function renderPage(role?: string) {
  if (role) {
    sessionStorage.setItem('trackhive.accessToken', tokenWithRole(role));
  }
  return render(
    <MemoryRouter initialEntries={['/personal/materiales']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/personal/materiales" element={<StaffMaterialsPage />} />
        </Route>
        <Route path="/materiales" element={<p>Pantalla de búsqueda</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StaffMaterialsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it.each(['PERSONAL', 'ADMIN'])(
    'lists the material with its status for %s',
    async (role) => {
      fetchMock.mockResolvedValue(listResponse([material()]));
      renderPage(role);

      expect(await screen.findByText('Acta 1')).toBeInTheDocument();
      expect(
        within(screen.getByRole('table')).getByText('Disponible'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cambiar estado de acta 1/i }),
      ).toBeInTheDocument();
    },
  );

  it('sends a PUBLICO user to the public search and loads nothing', () => {
    renderPage('PUBLICO');

    expect(screen.getByText('Pantalla de búsqueda')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a visitor without a session to the login', () => {
    renderPage();

    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saves the new status with the optional reason and shows it in the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(listResponse([material()]));
    renderPage('PERSONAL');

    await user.click(
      await screen.findByRole('button', { name: /cambiar estado de acta 1/i }),
    );
    await user.selectOptions(screen.getByLabelText('Estado'), [
      'EN_RESTAURACION',
    ]);
    await user.type(screen.getByLabelText(/motivo/i), 'Humedad en la caja');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => material({ status: 'EN_RESTAURACION' }),
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '«Acta 1» ahora está en restauración.',
    );
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`/api/v1/materials/${MATERIAL_ID}/status`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      status: 'EN_RESTAURACION',
      reason: 'Humedad en la caja',
    });
    expect(
      within(screen.getByRole('table')).getByText('En restauración'),
    ).toBeInTheDocument();
  });

  it('saves without a reason when the field is empty', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(listResponse([material()]));
    renderPage('PERSONAL');

    await user.click(
      await screen.findByRole('button', { name: /cambiar estado de acta 1/i }),
    );
    await user.selectOptions(screen.getByLabelText('Estado'), ['EN_USO']);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => material({ status: 'EN_USO' }),
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByRole('status');
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ status: 'EN_USO' });
  });

  it('shows the error in the form and keeps the status when saving fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(listResponse([material()]));
    renderPage('PERSONAL');

    await user.click(
      await screen.findByRole('button', { name: /cambiar estado de acta 1/i }),
    );
    await user.selectOptions(screen.getByLabelText('Estado'), ['EN_USO']);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'El material no existe.' }),
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El material no existe.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('table')).getByText('Disponible'),
    ).toBeInTheDocument();
  });

  it('closes the form without saving when the user cancels', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(listResponse([material()]));
    renderPage('PERSONAL');

    await user.click(
      await screen.findByRole('button', { name: /cambiar estado de acta 1/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
