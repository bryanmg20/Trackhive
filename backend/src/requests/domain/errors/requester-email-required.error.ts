import { DomainError } from '../../../common/errors/domain.error';

export class RequesterEmailRequiredError extends DomainError {
  readonly code = 'REQUESTER_EMAIL_REQUIRED';

  constructor() {
    super('El correo del solicitante es obligatorio.');
  }
}
