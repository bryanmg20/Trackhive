import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { MaterialsApiError } from './search-materials';
import type { MaterialStatus } from './search-materials';

export const MAX_LOAN_NOTES_LENGTH = 500;

export interface MaterialLoanPerson {
  id: string;
  name: string;
}

export interface MaterialLoanAppointment {
  id: string;
  date: string;
  requestId: string;
  trackingCode: string;
}

export interface AppointmentMaterialLoanSummary {
  id: string;
  handedOverAt: string;
  handedOverBy: MaterialLoanPerson;
  deliveryNotes: string | null;
  returnedAt: string | null;
  returnedBy: MaterialLoanPerson | null;
  returnNotes: string | null;
}

export interface MaterialLoanRecord {
  id: string;
  materialId: string;
  materialCatalogCode: string;
  materialTitle: string;
  materialStatus: MaterialStatus;
  appointment: MaterialLoanAppointment;
  requester: MaterialLoanPerson;
  handedOverAt: string;
  handedOverBy: MaterialLoanPerson;
  deliveryNotes: string | null;
  returnedAt: string | null;
  returnedBy: MaterialLoanPerson | null;
  returnNotes: string | null;
}

export interface MaterialHistoryResponse {
  material: {
    id: string;
    catalogCode: string;
    title: string;
    status: MaterialStatus;
  };
  lastLoan: MaterialLoanRecord | null;
  items: MaterialLoanRecord[];
  page: number;
  limit: number;
  total: number;
}

const BOGOTA_DATETIME_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

/** Formats an ISO timestamp in America/Bogota local date & time. */
export function formatBogotaDateTime(iso: string): string {
  return BOGOTA_DATETIME_FORMAT.format(new Date(iso));
}

/** Returns today's YYYY-MM-DD date in America/Bogota. */
export function todayInBogotaIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

async function readLoanError(
  response: Response,
  fallback: string,
): Promise<string> {
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
    // Response did not contain JSON.
  }
  return fallback;
}

/** Calls `POST /api/v1/appointments/:id/materials/:materialId/deliver` (HU-72). */
export async function deliverAppointmentMaterial(params: {
  appointmentId: string;
  materialId: string;
  notes?: string;
}): Promise<MaterialLoanRecord> {
  const response = await authenticatedFetch(
    apiUrl(
      `/api/v1/appointments/${encodeURIComponent(params.appointmentId)}/materials/${encodeURIComponent(params.materialId)}/deliver`,
    ),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.notes ? { notes: params.notes } : {}),
    },
  );
  if (!response.ok) {
    throw new MaterialsApiError(
      await readLoanError(
        response,
        'No pudimos registrar la entrega del material. Inténtelo de nuevo.',
      ),
      response.status,
    );
  }
  return (await response.json()) as MaterialLoanRecord;
}

/** Calls `POST /api/v1/materials/:id/return` (HU-72). */
export async function returnMaterial(params: {
  materialId: string;
  notes?: string;
}): Promise<MaterialLoanRecord> {
  const response = await authenticatedFetch(
    apiUrl(`/api/v1/materials/${encodeURIComponent(params.materialId)}/return`),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.notes ? { notes: params.notes } : {}),
    },
  );
  if (!response.ok) {
    throw new MaterialsApiError(
      await readLoanError(
        response,
        'No pudimos registrar la devolución del material. Inténtelo de nuevo.',
      ),
      response.status,
    );
  }
  return (await response.json()) as MaterialLoanRecord;
}

/** Calls `GET /api/v1/materials/:id/history` (HU-72). */
export async function getMaterialHistory(params: {
  materialId: string;
  page?: number;
  limit?: number;
}): Promise<MaterialHistoryResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.size > 0 ? `?${query}` : '';

  const response = await authenticatedFetch(
    apiUrl(
      `/api/v1/materials/${encodeURIComponent(params.materialId)}/history${suffix}`,
    ),
    {
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) {
    throw new MaterialsApiError(
      await readLoanError(
        response,
        'No pudimos cargar el historial del material. Inténtelo de nuevo.',
      ),
      response.status,
    );
  }
  return (await response.json()) as MaterialHistoryResponse;
}
