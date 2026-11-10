import { DomainError } from '../../../common/errors/domain.error';

/** Someone else changed the status first, so this change was not saved. */
export class RequestStatusConflictError extends DomainError {
  readonly code = 'REQUEST_STATUS_CONFLICT';

  constructor() {
    super(
      'La solicitud cambió de estado mientras se guardaba. Recargue la página e inténtelo de nuevo.',
    );
  }
}
