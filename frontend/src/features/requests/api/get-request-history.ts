import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { RequestsApiError } from './list-requests';
import type { RequestStatus } from './list-requests';

/** One status change of a request (HU-17). */
export interface RequestHistoryEntry {
  id: string;
  // Null only in the row of the registration
  previousStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedAt: string;
  // The full name for the staff; for the requester, their own name or
  // «Personal del CLENA»
  changedBy: string;
  comment: string | null;
}

export interface RequestHistory {
  requestId: string;
  trackingCode: string;
  // Oldest change first
  entries: RequestHistoryEntry[];
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
  return 'No pudimos cargar el historial. Inténtelo de nuevo.';
}

/** Calls the HU-17 endpoint `GET /api/v1/requests/:id/history`. */
export async function getRequestHistory(id: string): Promise<RequestHistory> {
  const response = await authenticatedFetch(
    apiUrl(`/api/v1/requests/${encodeURIComponent(id)}/history`),
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as RequestHistory;
}
