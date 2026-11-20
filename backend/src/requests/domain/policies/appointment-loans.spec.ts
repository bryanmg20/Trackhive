import { AppointmentHasLoansError } from '../errors/appointment-has-loans.error';
import { AppointmentHasUnreturnedMaterialsError } from '../errors/appointment-has-unreturned-materials.error';
import {
  type AppointmentLoanCounts,
  assertCanCancelOrRescheduleAppointment,
  assertCanSettleAppointmentOutcome,
  canCancelOrRescheduleAppointment,
  canSettleAppointmentOutcome,
} from './appointment-loans';

const NO_LOANS: AppointmentLoanCounts = { totalLoans: 0, openLoans: 0 };
const RETURNED_LOANS: AppointmentLoanCounts = { totalLoans: 2, openLoans: 0 };
const OPEN_LOANS: AppointmentLoanCounts = { totalLoans: 2, openLoans: 1 };

describe('appointment-loans policy (HU-72)', () => {
  describe('cancel or reschedule an appointment (RN-20)', () => {
    it('allows cancelling or rescheduling when the appointment has 0 loans', () => {
      expect(canCancelOrRescheduleAppointment(NO_LOANS)).toBe(true);
      expect(() =>
        assertCanCancelOrRescheduleAppointment(NO_LOANS),
      ).not.toThrow();
    });

    it('blocks cancelling or rescheduling when the appointment has returned loans', () => {
      expect(canCancelOrRescheduleAppointment(RETURNED_LOANS)).toBe(false);
      expect(() =>
        assertCanCancelOrRescheduleAppointment(RETURNED_LOANS),
      ).toThrow(AppointmentHasLoansError);
    });

    it('blocks cancelling or rescheduling when the appointment has open loans', () => {
      expect(canCancelOrRescheduleAppointment(OPEN_LOANS)).toBe(false);
      expect(() => assertCanCancelOrRescheduleAppointment(OPEN_LOANS)).toThrow(
        AppointmentHasLoansError,
      );
    });
  });

  describe('settle appointment as NO_ASISTIO (AGENDADA -> DISPONIBLE)', () => {
    it('allows NO_ASISTIO when the appointment has 0 loans', () => {
      expect(canSettleAppointmentOutcome('NO_ASISTIO', NO_LOANS)).toBe(true);
      expect(() =>
        assertCanSettleAppointmentOutcome('NO_ASISTIO', NO_LOANS),
      ).not.toThrow();
    });

    it('blocks NO_ASISTIO when the appointment has returned loans', () => {
      expect(canSettleAppointmentOutcome('NO_ASISTIO', RETURNED_LOANS)).toBe(
        false,
      );
      expect(() =>
        assertCanSettleAppointmentOutcome('NO_ASISTIO', RETURNED_LOANS),
      ).toThrow(AppointmentHasLoansError);
    });

    it('blocks NO_ASISTIO when the appointment has open loans', () => {
      expect(canSettleAppointmentOutcome('NO_ASISTIO', OPEN_LOANS)).toBe(false);
      expect(() =>
        assertCanSettleAppointmentOutcome('NO_ASISTIO', OPEN_LOANS),
      ).toThrow(AppointmentHasLoansError);
    });
  });

  describe('settle appointment as CUMPLIDA (AGENDADA -> ATENDIDA)', () => {
    it('allows CUMPLIDA when the appointment has 0 loans', () => {
      expect(canSettleAppointmentOutcome('CUMPLIDA', NO_LOANS)).toBe(true);
      expect(() =>
        assertCanSettleAppointmentOutcome('CUMPLIDA', NO_LOANS),
      ).not.toThrow();
    });

    it('allows CUMPLIDA when all loans of the appointment have been returned', () => {
      expect(canSettleAppointmentOutcome('CUMPLIDA', RETURNED_LOANS)).toBe(
        true,
      );
      expect(() =>
        assertCanSettleAppointmentOutcome('CUMPLIDA', RETURNED_LOANS),
      ).not.toThrow();
    });

    it('blocks CUMPLIDA when at least one loan is still open (unreturned)', () => {
      expect(canSettleAppointmentOutcome('CUMPLIDA', OPEN_LOANS)).toBe(false);
      expect(() =>
        assertCanSettleAppointmentOutcome('CUMPLIDA', OPEN_LOANS),
      ).toThrow(AppointmentHasUnreturnedMaterialsError);
    });
  });
});
