import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import {
  networkRequestApiError,
  readRequestApiError,
  RequestApiError,
} from '../../requests/api/request-api-error';

export type ExportableReport = 'most-requested-materials' | 'attention-times';
export interface ExportReportParams {
  from?: string;
  to?: string;
  limit?: number;
}

export async function getReportCsv(
  report: ExportableReport,
  params: ExportReportParams,
): Promise<{ blob: Blob; fileName: string }> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (report === 'most-requested-materials' && params.limit !== undefined)
    query.set('limit', String(params.limit));
  let response: Response;
  try {
    response = await authenticatedFetch(
      apiUrl(`/api/v1/reports/${report}/export?${query}`),
      { headers: { Accept: 'text/csv' } },
    );
  } catch {
    throw networkRequestApiError();
  }
  if (!response.ok) throw await readRequestApiError(response);
  if (
    !response.headers.get('content-type')?.toLowerCase().startsWith('text/csv')
  ) {
    throw new RequestApiError(
      0,
      'INVALID_CSV_RESPONSE',
      'El servidor no devolvió un archivo CSV. Inténtelo de nuevo.',
    );
  }
  const candidate = response.headers
    .get('content-disposition')
    ?.match(/filename="([^"]+)"/i)?.[1];
  const fileName =
    candidate && /^[a-z0-9_-]+\.csv$/i.test(candidate)
      ? candidate
      : `${report}.csv`;
  return { blob: await response.blob(), fileName };
}
