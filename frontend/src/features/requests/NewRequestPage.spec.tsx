import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewRequestPage } from './NewRequestPage';

const fetchMock = vi.fn();

describe('NewRequestPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('clears a previous tracking code when a later submission fails', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'c1b438db-f082-466f-9535-ec2e0ff2de1f',
              catalogCode: 'TH-DOC-0001',
              title: 'Acta de fundación de la villa',
            },
          ],
        }),
      })
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

    render(<NewRequestPage />);

    await user.type(screen.getByLabelText('Buscar en el archivo'), 'Acta');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: /Acta de fundación de la villa/,
      }),
    );
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
