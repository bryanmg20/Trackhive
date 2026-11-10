import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import {
  readErrorMessage,
  RequestsApiError,
} from './list-requests';
import type { RequestStatus, SortOrder } from './list-requests';

export const APPOINTMENT_STATUSES = [
  'PROGRAMADA',
  'CUMPLIDA',
  'CANCELADA',
  'NO_ASISTIO',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADA: 'Programada',
  CUMPLIDA: 'Cumplida',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
};

export type AppointmentSortField = 'appointmentDate' | 'createdAt';

export interface AppointmentMaterialItem {
  id: string;
  catalogCode: string;
  title: string;
  materialType: string;
  location: {
    depot: string;
    shelf: string;
    box: string;
  };
}

export interface AppointmentListItem {
  id: string;
  date: string;
  serviceHours: {
    opensAt: string;
    closesAt: string;
  };
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
  request: {
    id: string;
    trackingCode: string;
    status: RequestStatus;
    deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  };
  requester: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    requesterType: string;
    institution: string | null;
    documentType: string | null;
    documentNumber: string | null;
  };
  scheduledBy: {
    id: string;
    name: string;
  };
  materials: AppointmentMaterialItem[];
}

export interface AppointmentPage {
  items: AppointmentListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface ListAppointmentsParams {
  status?: AppointmentStatus;
  from?: string;
  to?: string;
  requester?: string;
  material?: string;
  sort: AppointmentSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

/** Calls the HU-19 endpoint `GET /api/v1/appointments`. */
export async function listAppointments(
  params: ListAppointmentsParams,
): Promise<AppointmentPage> {
  const query = new URLSearchParams({
    sort: params.sort,
    order: params.order,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) query.set('status', params.status);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.requester) query.set('requester', params.requester);
  if (params.material) query.set('material', params.material);

  const response = await authenticatedFetch(
    apiUrl(`/api/v1/appointments?${query}`),
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
  return (await response.json()) as AppointmentPage;
}
