import { DomainError } from '../../../common/errors/domain.error';

/**
 * Only an active PROGRAMADA appointment can be rescheduled or cancelled (HU-21).
 */
export class AppointmentNotScheduledError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_SCHEDULED';

  constructor() {
    super('Solo se puede reprogramar o cancelar una cita programada.');
  }
}
