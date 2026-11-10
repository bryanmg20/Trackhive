import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import type {
  MaterialStatus,
  MaterialType,
} from '../../materials/api/search-materials';
import { RequestsApiError } from './list-requests';
import type { RequestStatus } from './list-requests';

export interface RequestDetailMaterial {
  id: string;
  catalogCode: string;
  title: string;
  materialType: MaterialType;
  author: string | null;
  collection: string;
  status: MaterialStatus;
  location: { depot: string; shelf: string; box: string };
  itemStatus: string;
}

export interface RequestDetail {
  id: string;
  trackingCode: string;
  status: RequestStatus;
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  originChannel: string;
  reason: string | null;
  requirementDescription: string;
  desiredDate: string;
  committedDate: string | null;
  registeredAt: string;
  rejectionReason: string | null;
  requester: {
    name: string;
    email: string | null;
    phone: string | null;
    requesterType: string;
    institution: string | null;
    documentType: string | null;
    documentNumber: string | null;
  };
  materials: RequestDetailMaterial[];
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
  return 'No pudimos cargar la solicitud. Inténtelo de nuevo.';
}

/** Calls the HU-13 endpoint `GET /api/v1/requests/:id`. */
export async function getRequest(id: string): Promise<RequestDetail> {
  const response = await authenticatedFetch(
    apiUrl(`/api/v1/requests/${encodeURIComponent(id)}`),
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
  return (await response.json()) as RequestDetail;
}
