import { readAccessToken } from '../../auth/session';

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

export interface MaterialSearchResult {
  id: string;
  catalogCode: string;
  title: string;
}

interface MaterialSearchResponse {
  items: MaterialSearchResult[];
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

export async function searchMaterials(
  query: string,
): Promise<MaterialSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/v1/materials?${params}`, {
    headers: {
      Authorization: `Bearer ${readAccessToken() ?? ''}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as MaterialSearchResponse;
  return body.items;
}

export async function createRequest(input: CreateRequestInput): Promise<CreateRequestResponse> {
  const response = await fetch('/api/v1/requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${readAccessToken() ?? ''}`,
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
