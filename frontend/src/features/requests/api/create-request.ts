import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { apiUrl } from '../../auth/api/api-base-url';

export interface CreateRequestInput {
  materialIds: string[];
  reason: string;
  desiredDate: string;
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  requirementDescription?: string;
}

export interface CreateRequestResponse {
  id: string;
  trackingCode: string;
  status: 'RECIBIDA';
}

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json();
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }
  return 'La solicitud no pudo completarse.';
}

export async function createRequest(input: CreateRequestInput): Promise<CreateRequestResponse> {
  const response = await authenticatedFetch(apiUrl('/api/v1/requests'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as CreateRequestResponse;
}
