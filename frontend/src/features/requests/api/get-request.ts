import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import type {
  MaterialStatus,
  MaterialType,
} from '../../materials/api/search-materials';
import type { AppointmentMaterialLoanSummary } from '../../materials/api/material-loans';
import type { AppointmentStatus } from './list-appointments';
import type { RequestReference } from './material-references';
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
  itemStatus: string;
  // Whether the Everything sync found its digital copy (HU-139)
  hasDigitalCopy: boolean;
}

export interface RequestDetailAppointmentMaterial {
  id: string;
  catalogCode: string;
  title: string;
  status: MaterialStatus;
  activeLoan: AppointmentMaterialLoanSummary | null;
  lastLoan: AppointmentMaterialLoanSummary | null;
}

export interface RequestDetailActiveAppointment {
  id: string;
  date: string;
  serviceHours: {
    opensAt: string;
    closesAt: string;
  };
  status: AppointmentStatus;
  materials: RequestDetailAppointmentMaterial[];
}

export interface RequestDetail {
  id: string;
  trackingCode: string;
  status: RequestStatus;
  // Valid next statuses, computed by the backend state machine (HU-14)
  allowedTransitions: RequestStatus[];
  // Transitions whose comment is required, decided by the entity (HU-16, HU-09.2)
  commentRequiredFor: RequestStatus[];
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
  // Materials not in the catalog, described in writing (HU-09.2)
  references: RequestReference[];
  // Whether the staff can still associate material to them (HU-09.2)
  canResolveReferences: boolean;
  activeAppointment?: RequestDetailActiveAppointment | null;
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
