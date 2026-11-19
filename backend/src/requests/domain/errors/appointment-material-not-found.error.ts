import { DomainError } from '../../../common/errors/domain.error';

export class AppointmentMaterialNotFoundError extends DomainError {
  readonly code = 'APPOINTMENT_MATERIAL_NOT_FOUND';

  constructor() {
    super('El material indicado no forma parte de esta cita.');
  }
}
