import { DomainError } from '../../../common/errors/domain.error';

export class AppointmentHasLoansError extends DomainError {
  readonly code = 'APPOINTMENT_HAS_LOANS';

  constructor(
    message = 'La cita ya registra entregas de material y no puede cancelarse, reprogramarse ni marcarse como inasistencia.',
  ) {
    super(message);
  }
}
