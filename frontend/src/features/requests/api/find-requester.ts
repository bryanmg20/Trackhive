import { readAccessToken } from '../../auth/session';
import {
  RequestApiError,
  networkRequestApiError,
  readRequestApiError,
} from './request-api-error';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export interface RequesterProfile {
  requesterId: string | null;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
  phone: string | null;
  requesterType: string | null;
  institution: string | null;
  documentType: string | null;
  documentNumber: string | null;
  foundIn: 'REQUESTER' | 'USER';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRequesterProfile(value: unknown): value is RequesterProfile {
  return (
    isRecord(value) &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    typeof value.email === 'string' &&
    (value.foundIn === 'REQUESTER' || value.foundIn === 'USER')
  );
}

/**
 * Looks up a requester by email (HU-10).
 * Returns `null` when the backend answers 404: it is a valid "new person" state,
 * not an error the screen has to show as a failure.
 */
export async function findRequesterByEmail(
  email: string,
): Promise<RequesterProfile | null> {
  const query = new URLSearchParams({ email: email.trim().toLowerCase() });
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/requesters/by-email?${query}`,
      {
        headers: {
          Authorization: `Bearer ${readAccessToken() ?? ''}`,
          Accept: 'application/json',
        },
      },
    );
  } catch {
    throw networkRequestApiError();
  }

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await readRequestApiError(response);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new RequestApiError(
      response.status,
      'INVALID_RESPONSE',
      'La respuesta del servidor no es válida.',
    );
  }

  if (!isRequesterProfile(body)) {
    throw new RequestApiError(
      response.status,
      'INVALID_RESPONSE',
      'La respuesta del servidor no es válida.',
    );
  }

  return body;
}
