import type { AppointmentStatus } from '../enums/appointment-status';
import type { RequestStatus } from '../enums/request-status';

/**
 * Immutable record of one status change of a request («CambioEstado» in
 * docs/modelo-dominio.md §4): who made it, when, and an optional comment.
 * It becomes one row of status_history (D-08).
 */
export interface StatusChange {
  readonly requestId: string;
  readonly previousStatus: RequestStatus;
  readonly newStatus: RequestStatus;
  readonly changedBy: string;
  readonly changedAt: Date;
  readonly comment: string | null;
  // Only when the change rejects the request: the reason the requester reads (HU-16)
  readonly rejectionReason: string | null;
  // When the request was attended (ATENDIDA) or closed (CERRADA): the change's date
  readonly attendedAt: Date | null;
  readonly closedAt: Date | null;
  // Leaving AGENDADA settles the PROGRAMADA appointment: CUMPLIDA when the
  // requester attended (ATENDIDA), NO_ASISTIO when not (DISPONIBLE), and the
  // day of its materials is free again (HU-20). Null for any other change
  readonly appointmentOutcome: Extract<
    AppointmentStatus,
    'CUMPLIDA' | 'NO_ASISTIO'
  > | null;
}
