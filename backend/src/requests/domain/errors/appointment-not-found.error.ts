import { DomainError } from '../../../common/errors/domain.error';

export class AppointmentNotFoundError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_FOUND';

  constructor() {
    super('La cita no existe.');
  }
}
