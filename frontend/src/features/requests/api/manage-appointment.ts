import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import type { StatusChange } from './change-request-status';
import { RequestsApiError } from './list-requests';
import type { RequestStatus } from './list-requests';
import type { ScheduleAppointmentResult } from './schedule-appointment';

export interface RescheduleAppointmentParams {
  appointmentId: string;
  // YYYY-MM-DD
  date: string;
  comment?: string;
}

export interface CancelAppointmentParams {
  appointmentId: string;
  comment?: string;
}

export interface CancelAppointmentResult {
  id: string;
  status: RequestStatus;
  allowedTransitions: RequestStatus[];
  appointment: {
    id: string;
    date: string;
    status: 'CANCELADA';
  };
  statusChange: StatusChange;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
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
    // Response did not contain JSON.
  }
  return fallback;
}

/** Calls the HU-21 endpoint `PATCH /api/v1/appointments/:id/reschedule`. */
export async function rescheduleAppointment(
  params: RescheduleAppointmentParams,
): Promise<ScheduleAppointmentResult> {
  const response = await authenticatedFetch(
    apiUrl(
      `/api/v1/appointments/${encodeURIComponent(params.appointmentId)}/reschedule`,
    ),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: params.date,
        ...(params.comment ? { comment: params.comment } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(
        response,
        'No pudimos reprogramar la cita. Inténtelo de nuevo.',
      ),
      response.status,
    );
  }
  return (await response.json()) as ScheduleAppointmentResult;
}

/** Calls the HU-21 endpoint `PATCH /api/v1/appointments/:id/cancel`. */
export async function cancelAppointment(
  params: CancelAppointmentParams,
): Promise<CancelAppointmentResult> {
  const response = await authenticatedFetch(
    apiUrl(
      `/api/v1/appointments/${encodeURIComponent(params.appointmentId)}/cancel`,
    ),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        params.comment ? { comment: params.comment } : {},
      ),
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(
        response,
        'No pudimos cancelar la cita. Inténtelo de nuevo.',
      ),
      response.status,
    );
  }
  return (await response.json()) as CancelAppointmentResult;
}
