import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { readSessionRole } from '../auth/session';
import {
  networkRequestApiError,
  RequestApiError,
} from '../requests/api/request-api-error';
import { getReportCsv } from './api/export-report';
import type { ExportableReport, ExportReportParams } from './api/export-report';
import styles from './MostRequestedMaterialsPage.module.css';

interface ExportReportButtonProps {
  report: ExportableReport;
  params: ExportReportParams;
  disabled: boolean;
}

export function ExportReportButton({
  report,
  params,
  disabled,
}: ExportReportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    key: string;
    error?: RequestApiError;
    done?: boolean;
  } | null>(null);
  const key = JSON.stringify({ report, params });
  const current = feedback?.key === key ? feedback : null;
  const isAdmin = readSessionRole() === 'ADMIN';
  if (!isAdmin && !current?.error) return null;

  async function download() {
    setBusy(true);
    setFeedback(null);
    try {
      const { blob, fileName } = await getReportCsv(report, params);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        // Safari/Firefox may cancel downloads when the URL is revoked synchronously.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setFeedback({ key, done: true });
    } catch (caught: unknown) {
      setFeedback({
        key,
        error:
          caught instanceof RequestApiError ? caught : networkRequestApiError(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.results} ${styles.exportActions}`}>
      {isAdmin ? (
        <div>
          <button
            type="button"
            className={styles.secondary}
            disabled={disabled || busy}
            aria-busy={busy}
            onClick={() => void download()}
          >
            {busy ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </div>
      ) : null}
      {current?.done ? <p role="status">Descarga CSV iniciada.</p> : null}
      {current?.error ? (
        <div role="alert">
          <p>
            {current.error.status === 403
              ? 'Solo ADMIN puede exportar reportes.'
              : current.error.status === 401
                ? 'Su sesión no es válida o venció.'
                : current.error.message}
          </p>
          {current.error.status === 401 ? (
            <Link to={ROUTES.login}>Iniciar sesión</Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
