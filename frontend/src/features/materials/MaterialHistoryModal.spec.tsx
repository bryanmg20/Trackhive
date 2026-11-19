import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialHistoryModal } from './MaterialHistoryModal';

const fetchMock = vi.fn();

describe('MaterialHistoryModal (HU-72)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('trackhive.accessToken', 'token-123');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the empty message when the material has never been handed over', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        material: {
          id: 'mat-1',
          catalogCode: 'TH-DOC-0001',
          title: 'Acta 1',
          status: 'DISPONIBLE',
        },
        lastLoan: null,
        items: [],
        page: 1,
        limit: 10,
        total: 0,
      }),
    });

    render(
      <MemoryRouter>
        <MaterialHistoryModal
          materialId="mat-1"
          materialTitle="Acta 1"
          materialCatalogCode="TH-DOC-0001"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Este material aún no registra entregas en sala.'),
    ).toBeInTheDocument();
  });

  it('shows an in-use label when the last loan has not been returned yet', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        material: {
          id: 'mat-1',
          catalogCode: 'TH-DOC-0001',
          title: 'Acta 1',
          status: 'EN_USO',
        },
        lastLoan: {
          id: 'loan-1',
          materialId: 'mat-1',
          materialCatalogCode: 'TH-DOC-0001',
          materialTitle: 'Acta 1',
          materialStatus: 'EN_USO',
          appointment: {
            id: 'app-1',
            date: '2026-11-19',
            requestId: 'req-1',
            trackingCode: 'SOL-2026-00001',
          },
          requester: { id: 'req-1', name: 'Carlos Ruiz' },
          handedOverAt: '2026-11-19T14:00:00.000Z',
          handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
          deliveryNotes: null,
          returnedAt: null,
          returnedBy: null,
          returnNotes: null,
        },
        items: [
          {
            id: 'loan-1',
            materialId: 'mat-1',
            materialCatalogCode: 'TH-DOC-0001',
            materialTitle: 'Acta 1',
            materialStatus: 'EN_USO',
            appointment: {
              id: 'app-1',
              date: '2026-11-19',
              requestId: 'req-1',
              trackingCode: 'SOL-2026-00001',
            },
            requester: { id: 'req-1', name: 'Carlos Ruiz' },
            handedOverAt: '2026-11-19T14:00:00.000Z',
            handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
            deliveryNotes: null,
            returnedAt: null,
            returnedBy: null,
            returnNotes: null,
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      }),
    });

    render(
      <MemoryRouter>
        <MaterialHistoryModal
          materialId="mat-1"
          materialTitle="Acta 1"
          materialCatalogCode="TH-DOC-0001"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Actualmente en uso \(pendiente de devolución\)/i),
    ).toBeInTheDocument();
  });
});
