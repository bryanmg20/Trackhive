import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestHistory } from './RequestHistory';

const fetchMock = vi.fn();

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    previousStatus: null,
    newStatus: 'RECIBIDA',
    changedAt: '2026-11-10T15:00:00.000Z',
    changedBy: 'Juan Pérez',
    comment: null,
    ...overrides,
  };
}

function renderHistory() {
  return render(
    <RequestHistory requestId="request-1" label="Historial de SOL-1" />,
  );
}

describe('RequestHistory', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('lists the changes oldest first, as the backend sends them', async () => {
    fetchMock.mockResolvedValue(
      ok({
        requestId: 'request-1',
        trackingCode: 'SOL-1',
        entries: [
          entry(),
          entry({
            id: '2',
            previousStatus: 'RECIBIDA',
            newStatus: 'RECHAZADA',
            changedAt: '2026-11-12T20:15:00.000Z',
            changedBy: 'Personal del CLENA',
            comment: 'Material restringido',
          }),
        ],
      }),
    );
    renderHistory();

    const timeline = await screen.findByRole('list', {
      name: 'Historial de SOL-1',
    });
    const items = within(timeline).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Solicitud registrada: Recibida');
    // 3:15 p. m. in Bogotá, with the machine-readable date for assistive tech
    expect(within(items[1]).getByText(/12\/11\/2026/)).toHaveAttribute(
      'datetime',
      '2026-11-12T20:15:00.000Z',
    );
    expect(items[1]).toHaveTextContent(/03:15/);
    // The arrow is read as words
    expect(items[1]).toHaveTextContent(/Recibida.*pasó a.*Rechazada/);
    expect(items[1]).toHaveTextContent(
      'Motivo del rechazo: Material restringido',
    );
  });

  it('says so when there are no changes yet', async () => {
    fetchMock.mockResolvedValue(
      ok({ requestId: 'request-1', trackingCode: 'SOL-1', entries: [] }),
    );
    renderHistory();

    expect(
      await screen.findByText('Esta solicitud aún no tiene cambios registrados.'),
    ).toBeInTheDocument();
  });

  it('shows a network error as a clear message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor.',
    );
  });
});
