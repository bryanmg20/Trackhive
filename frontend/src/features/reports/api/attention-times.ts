import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import {
  networkRequestApiError,
  readRequestApiError,
} from '../../requests/api/request-api-error';

export interface AttentionTimesParams {
  from?: string;
  to?: string;
}
export interface AttentionTimes {
  from: string | null;
  to: string | null;
  completedRequests: number;
  averageSeconds: number | null;
  states: {
    state: 'RECIBIDA' | 'EN_BUSQUEDA' | 'DISPONIBLE' | 'AGENDADA';
    requestCount: number;
    averageSeconds: number | null;
  }[];
}

export async function getAttentionTimes(
  params: AttentionTimesParams,
): Promise<AttentionTimes> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  let response: Response;
  try {
    response = await authenticatedFetch(
      apiUrl(`/api/v1/reports/attention-times?${query}`),
      { headers: { Accept: 'application/json' } },
    );
  } catch {
    throw networkRequestApiError();
  }
  if (!response.ok) throw await readRequestApiError(response);
  return (await response.json()) as AttentionTimes;
}

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'Sin datos';
  if (seconds >= 86400)
    return `${number.format(seconds / 86400)} ${seconds === 86400 ? 'día' : 'días'}`;
  if (seconds >= 3600) return `${number.format(seconds / 3600)} h`;
  if (seconds >= 60) return `${number.format(seconds / 60)} min`;
  if (seconds > 0 && seconds < 0.01) return 'Menos de 0,01 s';
  return `${number.format(seconds)} s`;
}
