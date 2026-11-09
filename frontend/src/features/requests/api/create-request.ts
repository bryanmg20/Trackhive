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

export async function createRequest(input: CreateRequestInput): Promise<CreateRequestResponse> {
  const response = await fetch('/api/v1/requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'message' in body
      ? String(body.message)
      : 'No fue posible radicar la solicitud.';
    throw new Error(message);
  }
  return body as CreateRequestResponse;
}
