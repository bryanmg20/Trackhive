import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { RequestsApiError } from './list-requests';
import type { RequestStatus } from './list-requests';

export const MAX_STATUS_COMMENT_LENGTH = 500;

export interface ChangeRequestStatusParams {
  requestId: string;
  status: RequestStatus;
  comment?: string;
}

export interface StatusChange {
  previousStatus: RequestStatus;
  newStatus: RequestStatus;
  // ISO 8601 date and time, in UTC
  changedAt: string;
  changedBy: { id: string; name: string };
  comment: string | null;
}

export interface ChangeRequestStatusResult {
  id: string;
  status: RequestStatus;
  allowedTransitions: RequestStatus[];
  statusChange: StatusChange;
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
  return 'No pudimos cambiar el estado. Inténtelo de nuevo.';
}

/** Calls the HU-15 endpoint `PATCH /api/v1/requests/:id/status`. */
export async function changeRequestStatus(
  params: ChangeRequestStatusParams,
): Promise<ChangeRequestStatusResult> {
  const response = await authenticatedFetch(
    apiUrl(`/api/v1/requests/${encodeURIComponent(params.requestId)}/status`),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: params.status,
        ...(params.comment ? { comment: params.comment } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as ChangeRequestStatusResult;
}
