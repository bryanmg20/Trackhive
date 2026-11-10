import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import type { StatusChange } from './change-request-status';
import { RequestsApiError } from './list-requests';
import type { RequestStatus } from './list-requests';

export interface ScheduleAppointmentParams {
  requestId: string;
  // YYYY-MM-DD, without a time
  date: string;
}

export interface Appointment {
  id: string;
  // YYYY-MM-DD
  date: string;
  // The appointment has no time: the requester can come during these hours
  serviceHours: { opensAt: string; closesAt: string };
  status: 'PROGRAMADA';
  requester: { id: string; name: string };
  materials: { id: string; catalogCode: string; title: string }[];
}

export interface ScheduleAppointmentResult {
  id: string;
  status: RequestStatus;
  allowedTransitions: RequestStatus[];
  appointment: Appointment;
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
  return 'No pudimos agendar la cita. Inténtelo de nuevo.';
}

/** Calls the HU-18 endpoint `POST /api/v1/requests/:id/appointments`. */
export async function scheduleAppointment(
  params: ScheduleAppointmentParams,
): Promise<ScheduleAppointmentResult> {
  const response = await authenticatedFetch(
    apiUrl(
      `/api/v1/requests/${encodeURIComponent(params.requestId)}/appointments`,
    ),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date: params.date }),
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as ScheduleAppointmentResult;
}
