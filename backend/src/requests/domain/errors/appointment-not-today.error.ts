import { DomainError } from '../../../common/errors/domain.error';

export class AppointmentNotTodayError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_TODAY';

  constructor() {
    super(
      'Solo se pueden entregar materiales para una cita programada para el día de hoy.',
    );
  }
}
