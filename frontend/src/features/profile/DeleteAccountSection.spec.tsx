import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteAccountSection } from './DeleteAccountSection';
describe('DeleteAccountSection', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.setItem('trackhive.accessToken', 'access');
    sessionStorage.setItem('trackhive.refreshToken', 'refresh');
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  });
  it('requires confirmation and cancellation sends nothing and restores focus', async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection onDeleted={vi.fn()} />);
    const opener = screen.getByRole('button', { name: 'Eliminar mi cuenta' });
    await user.click(opener);
    expect(
      screen.getByRole('button', { name: 'Confirmar eliminación' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });
  it('deletes only after confirmation and clears both tokens on success', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    const done = vi.fn();
    const user = userEvent.setup();
    render(<DeleteAccountSection onDeleted={done} />);
    await user.click(
      screen.getByRole('button', { name: 'Eliminar mi cuenta' }),
    );
    await user.click(screen.getByRole('checkbox'));
    const button = screen.getByRole('button', {
      name: 'Confirmar eliminación',
    });
    button.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/users/me/profile',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ confirmation: true }),
      }),
    );
    expect(sessionStorage.getItem('trackhive.accessToken')).toBeNull();
    expect(sessionStorage.getItem('trackhive.refreshToken')).toBeNull();
  });
  it('shows a business conflict without clearing the session or claiming deletion', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        code: 'LAST_ADMIN_CANNOT_BE_DELETED',
        message: 'Debe existir otro administrador activo.',
      }),
    });
    const done = vi.fn();
    render(<DeleteAccountSection onDeleted={done} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar eliminación' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debe existir otro administrador activo.',
    );
    expect(done).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('trackhive.accessToken')).toBe('access');
    expect(
      screen.getByRole('button', { name: 'Confirmar eliminación' }),
    ).toBeEnabled();
  });

  it('keeps the session and allows retry when deletion fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    render(<DeleteAccountSection onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar eliminación' }),
    );
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(sessionStorage.getItem('trackhive.accessToken')).toBe('access');
    expect(
      screen.getByRole('button', { name: 'Confirmar eliminación' }),
    ).toBeEnabled();
  });
});
