import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportReportButton } from './ExportReportButton';
import { MostRequestedMaterialsPage } from './MostRequestedMaterialsPage';
import { AttentionTimesPage } from './AttentionTimesPage';

const fetchMock = vi.fn();
const createUrl = vi.fn(() => 'blob:report');
const revokeUrl = vi.fn();
const NativeURL = URL;
const ranking = { from: null, to: null, totalRequests: 0, items: [] };
const attention = {
  from: null,
  to: null,
  completedRequests: 0,
  averageSeconds: null,
  states: [],
};
const csv = () => ({
  ok: true,
  status: 200,
  headers: new Headers({
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="reporte.csv"',
  }),
  blob: async () => new Blob(['\uFEFF"csv"\r\n']),
});
const session = (role: string) =>
  sessionStorage.setItem(
    'trackhive.accessToken',
    `header.${btoa(JSON.stringify({ role, exp: Date.now() / 1000 + 3600 }))}.signature`,
  );

describe('CSV export UI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    createUrl.mockClear();
    revokeUrl.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'URL',
      class extends NativeURL {
        static createObjectURL = createUrl;
        static revokeObjectURL = revokeUrl;
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it.each(['PUBLICO', 'PERSONAL'])('does not offer export to %s', (role) => {
    session(role);
    render(
      <MemoryRouter>
        <ExportReportButton
          report="most-requested-materials"
          params={{ limit: 10 }}
          disabled={false}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('button', { name: 'Exportar CSV' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['most-requested-materials', 'Registradas desde', 'Registradas hasta'],
    ['attention-times', 'Radicadas desde', 'Radicadas hasta'],
  ])(
    'downloads %s with applied filters, ignoring edits not yet applied',
    async (report, fromLabel, toLabel) => {
      const user = userEvent.setup();
      session('ADMIN');
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          url.includes('/export?')
            ? csv()
            : {
                ok: true,
                status: 200,
                json: async () =>
                  report === 'attention-times' ? attention : ranking,
              },
        ),
      );
      render(
        <MemoryRouter>
          {report === 'attention-times' ? (
            <AttentionTimesPage />
          ) : (
            <MostRequestedMaterialsPage />
          )}
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Exportar CSV' }),
        ).toBeEnabled(),
      );
      fireEvent.change(screen.getByLabelText(fromLabel), {
        target: { value: '2026-11-01' },
      });
      fireEvent.change(screen.getByLabelText(toLabel), {
        target: { value: '2026-11-30' },
      });
      if (report === 'most-requested-materials')
        await user.selectOptions(screen.getByLabelText('Mostrar'), '20');
      await user.click(screen.getByRole('button', { name: 'Aplicar fechas' }));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Exportar CSV' }),
        ).toBeEnabled(),
      );
      fireEvent.change(screen.getByLabelText(fromLabel), {
        target: { value: '2027-01-01' },
      });
      const button = screen.getByRole('button', { name: 'Exportar CSV' });
      button.focus();
      await user.keyboard('{Enter}');
      await screen.findByText('Descarga CSV iniciada.');
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/v1/reports/${report}/export?from=2026-11-01&to=2026-11-30${report === 'most-requested-materials' ? '&limit=20' : ''}`,
        expect.anything(),
      );
      expect(createUrl).toHaveBeenCalledOnce();
      expect(revokeUrl).toHaveBeenCalledWith('blob:report');
      expect(document.querySelector('a[download]')).toBeNull();
    },
  );

  it('disables export while a report is loading and reports a forbidden download without creating a file', async () => {
    const user = userEvent.setup();
    session('ADMIN');
    const view = render(
      <MemoryRouter>
        <ExportReportButton report="attention-times" params={{}} disabled />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });
    view.rerender(
      <MemoryRouter>
        <ExportReportButton
          report="attention-times"
          params={{}}
          disabled={false}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo ADMIN puede exportar reportes.',
    );
    expect(createUrl).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  });

  it('explains an expired session without offering a file', async () => {
    const user = userEvent.setup();
    session('ADMIN');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Expired' }),
    });
    render(
      <MemoryRouter>
        <ExportReportButton
          report="attention-times"
          params={{}}
          disabled={false}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Su sesión no es válida o venció.',
    );
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
    expect(createUrl).not.toHaveBeenCalled();
  });
});
