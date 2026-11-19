import { AppointmentHasLoansError } from '../errors/appointment-has-loans.error';
import { AppointmentHasUnreturnedMaterialsError } from '../errors/appointment-has-unreturned-materials.error';

/**
 * Custody loan counts of an appointment (HU-72):
 * - `totalLoans`: total deliveries registered for the appointment (open + returned).
 * - `openLoans`: deliveries still in use (`returned_at IS NULL`).
 */
export interface AppointmentLoanCounts {
  readonly totalLoans: number;
  readonly openLoans: number;
}

/**
 * An appointment can only be cancelled or rescheduled before any material has
 * been handed over in the reading room (HU-21, HU-72, RN-20).
 */
export function canCancelOrRescheduleAppointment(
  counts: AppointmentLoanCounts,
): boolean {
  return counts.totalLoans === 0;
}

/**
 * Throws AppointmentHasLoansError (409) if the appointment already has at
 * least one material delivery recorded (HU-72, RN-20).
 */
export function assertCanCancelOrRescheduleAppointment(
  counts: AppointmentLoanCounts,
): void {
  if (!canCancelOrRescheduleAppointment(counts)) {
    throw new AppointmentHasLoansError();
  }
}

/**
 * Decides whether a PROGRAMADA appointment can be settled with the given
 * outcome when the request leaves AGENDADA (HU-15, HU-21, HU-72):
 * - `NO_ASISTIO` / `CANCELADA` (`AGENDADA → DISPONIBLE`): requires zero
 *   deliveries recorded, because a requester who received material in the room
 *   did attend.
 * - `CUMPLIDA` (`AGENDADA → ATENDIDA`): requires zero open loans, so every
 *   material handed over has already been returned.
 */
export function canSettleAppointmentOutcome(
  outcome: 'CUMPLIDA' | 'NO_ASISTIO' | 'CANCELADA',
  counts: AppointmentLoanCounts,
): boolean {
  if (outcome === 'NO_ASISTIO' || outcome === 'CANCELADA') {
    return counts.totalLoans === 0;
  }
  return counts.openLoans === 0;
}

/**
 * Validates that the appointment outcome is compatible with its material loans
 * (HU-72). Throws AppointmentHasLoansError (409) for NO_ASISTIO/CANCELADA with
 * loans, or AppointmentHasUnreturnedMaterialsError (409) for CUMPLIDA with open loans.
 */
export function assertCanSettleAppointmentOutcome(
  outcome: 'CUMPLIDA' | 'NO_ASISTIO' | 'CANCELADA',
  counts: AppointmentLoanCounts,
): void {
  if (
    (outcome === 'NO_ASISTIO' || outcome === 'CANCELADA') &&
    !canSettleAppointmentOutcome(outcome, counts)
  ) {
    throw new AppointmentHasLoansError();
  }
  if (outcome === 'CUMPLIDA' && !canSettleAppointmentOutcome(outcome, counts)) {
    throw new AppointmentHasUnreturnedMaterialsError();
  }
}
