import { DomainError } from '../../../common/errors/domain.error';

export class AppointmentHasUnreturnedMaterialsError extends DomainError {
  readonly code = 'APPOINTMENT_HAS_UNRETURNED_MATERIALS';

  constructor() {
    super(
      'No se puede marcar la solicitud como atendida mientras haya materiales entregados pendientes de devolución.',
    );
  }
}
