import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

const fetchMock = vi.fn();
const saved = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  municipality: 'Barranquilla',
  ageRange: '18-28',
  populationGroup: 'MIGRANTE',
};
const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});
function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

describe('My profile', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'access');
  });

  it('loads previously saved values and lists all groups in uppercase without numbering', async () => {
    fetchMock.mockResolvedValue(ok(saved));
    renderPage();
    expect(await screen.findByLabelText('Municipio o distrito')).toHaveValue(
      'Barranquilla',
    );
    expect(screen.getByLabelText('Rango de edad')).toHaveValue('18-28');
    expect(screen.getByLabelText('Grupo poblacional (opcional)')).toHaveValue(
      'MIGRANTE',
    );
    const group = screen.getByLabelText(
      'Grupo poblacional (opcional)',
    ) as HTMLSelectElement;
    expect(group.options).toHaveLength(12);
    for (const option of Array.from(group.options)) {
      expect(option.text).toBe(option.text.toUpperCase());
      expect(option.text).not.toMatch(/^\d+[.)]/);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/users/me/profile',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access' }),
      }),
    );
  });

  it('saves edited values and the explicit preference not to respond', async () => {
    const user = userEvent.setup();
    const updated = {
      ...saved,
      municipality: 'Soledad',
      ageRange: '60+',
      populationGroup: 'PREFIERO_NO_RESPONDER',
    };
    fetchMock
      .mockResolvedValueOnce(ok(saved))
      .mockResolvedValueOnce(ok(updated));
    renderPage();
    await screen.findByLabelText('Municipio o distrito');
    fireEvent.change(screen.getByLabelText('Municipio o distrito'), {
      target: { value: 'Soledad' },
    });
    await user.selectOptions(screen.getByLabelText('Rango de edad'), '60+');
    await user.selectOptions(
      screen.getByLabelText('Grupo poblacional (opcional)'),
      'PREFIERO_NO_RESPONDER',
    );
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sus datos se guardaron correctamente.',
    );
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      municipality: 'Soledad',
      ageRange: '60+',
      populationGroup: 'PREFIERO_NO_RESPONDER',
    });
  });

  it('allows leaving the population group empty and sends null to remove a previous answer', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(ok(saved))
      .mockResolvedValueOnce(ok({ ...saved, populationGroup: null }));
    renderPage();
    await screen.findByLabelText('Municipio o distrito');
    await user.selectOptions(
      screen.getByLabelText('Grupo poblacional (opcional)'),
      '',
    );
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Sus datos se guardaron correctamente.');
    expect(
      JSON.parse(fetchMock.mock.calls[1][1].body as string).populationGroup,
    ).toBeNull();
  });

  it('requires municipality and age for an incomplete legacy profile', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      ok({
        ...saved,
        municipality: null,
        ageRange: null,
        populationGroup: null,
      }),
    );
    renderPage();
    await screen.findByLabelText('Municipio o distrito');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(
      await screen.findByText('Escriba su municipio o distrito.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Seleccione su rango de edad.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps edits after a failed save and allows retrying', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(ok(saved))
      .mockRejectedValueOnce(new TypeError('Offline'));
    renderPage();
    await screen.findByLabelText('Municipio o distrito');
    fireEvent.change(screen.getByLabelText('Municipio o distrito'), {
      target: { value: 'Soledad' },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Municipio o distrito')).toHaveValue(
      'Soledad',
    );
    expect(
      screen.queryByText('Sus datos se guardaron correctamente.'),
    ).not.toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(ok({ ...saved, municipality: 'Soledad' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Sus datos se guardaron correctamente.');
  });

  it('shows a login link when the session is rejected', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Su sesión venció' }),
    });
    renderPage();
    expect(
      await screen.findByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('retries a failed profile load', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValueOnce(ok(saved));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Municipio o distrito')).toHaveValue(
        'Barranquilla',
      ),
    );
  });
});
