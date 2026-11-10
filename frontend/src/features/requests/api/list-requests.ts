import { readAccessToken } from '../../auth/session';

export const REQUEST_STATUSES = [
  'RECIBIDA',
  'EN_BUSQUEDA',
  'DISPONIBLE',
  'AGENDADA',
  'ATENDIDA',
  'CERRADA',
  'RECHAZADA',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  RECIBIDA: 'Recibida',
  EN_BUSQUEDA: 'En búsqueda',
  DISPONIBLE: 'Disponible',
  AGENDADA: 'Agendada',
  ATENDIDA: 'Atendida',
  CERRADA: 'Cerrada',
  RECHAZADA: 'Rechazada',
};

export type RequestSortField = 'registeredAt' | 'desiredDate';
export type SortOrder = 'asc' | 'desc';

export interface RequestListItem {
  id: string;
  trackingCode: string;
  status: RequestStatus;
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  desiredDate: string;
  registeredAt: string;
  requesterName: string;
  requesterEmail: string | null;
  materials: { id: string; catalogCode: string; title: string }[];
}

export interface RequestPage {
  items: RequestListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface ListRequestsParams {
  status?: RequestStatus;
  desiredFrom?: string;
  desiredTo?: string;
  requester?: string;
  material?: string;
  sort: RequestSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

/** Thrown when the API rejects the list; `status` 401 means no valid session. */
export class RequestsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RequestsApiError';
    this.status = status;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      return body.message;
    }
  } catch {
    // The response did not contain JSON.
  }
  return 'No pudimos cargar las solicitudes. Inténtelo de nuevo.';
}

/** Calls the HU-12 endpoint `GET /api/v1/requests`. */
export async function listRequests(
  params: ListRequestsParams,
): Promise<RequestPage> {
  const query = new URLSearchParams({
    sort: params.sort,
    order: params.order,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) query.set('status', params.status);
  if (params.desiredFrom) query.set('desiredFrom', params.desiredFrom);
  if (params.desiredTo) query.set('desiredTo', params.desiredTo);
  if (params.requester) query.set('requester', params.requester);
  if (params.material) query.set('material', params.material);

  const response = await fetch(`/api/v1/requests?${query}`, {
    headers: {
      Authorization: `Bearer ${readAccessToken() ?? ''}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as RequestPage;
}
