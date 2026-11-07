import { DomainError } from '../../../common/errors/domain.error';

export class RejectionReasonRequiredError extends DomainError {
  readonly code = 'REJECTION_REASON_REQUIRED';

  constructor() {
    super('El motivo del rechazo es obligatorio');
  }
}
