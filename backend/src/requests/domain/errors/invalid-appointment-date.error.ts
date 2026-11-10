import { DomainError } from '../../../common/errors/domain.error';

/** The appointment date is not a valid date or the CLENA does not attend that day. */
export class InvalidAppointmentDateError extends DomainError {
  readonly code = 'INVALID_APPOINTMENT_DATE';

  constructor(message: string) {
    super(message);
  }
}
