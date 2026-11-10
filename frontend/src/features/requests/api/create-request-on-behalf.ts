import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { apiUrl } from '../../auth/api/api-base-url';
import {
  RequestApiError,
  networkRequestApiError,
  readRequestApiError,
} from './request-api-error';

export type DeliveryMode = 'PRESENCIAL' | 'DIGITAL';

export interface RequesterPayload {
  email: string;
  userId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  secondLastName?: string;
  phone?: string;
  requesterType?: string;
  institution?: string;
  documentType?: string;
  documentNumber?: string;
}

export interface CreateRequestOnBehalfInput {
  materialIds: string[];
  reason: string;
  desiredDate: string;
  deliveryMode: DeliveryMode;
  requester: RequesterPayload;
}

export interface CreateRequestOnBehalfResponse {
  id: string;
  trackingCode: string;
  status: 'RECIBIDA';
}

function isCreateResponse(
  value: unknown,
): value is CreateRequestOnBehalfResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'trackingCode' in value &&
    typeof value.trackingCode === 'string'
  );
}

/** Calls the HU-10 endpoint `POST /api/v1/requests/on-behalf`. */
export async function createRequestOnBehalf(
  input: CreateRequestOnBehalfInput,
): Promise<CreateRequestOnBehalfResponse> {
  let response: Response;

  try {
    response = await authenticatedFetch(apiUrl('/api/v1/requests/on-behalf'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw networkRequestApiError();
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

  if (!isCreateResponse(body)) {
    throw new RequestApiError(
      response.status,
      'INVALID_RESPONSE',
      'La respuesta del servidor no es válida.',
    );
  }

  return body;
}
