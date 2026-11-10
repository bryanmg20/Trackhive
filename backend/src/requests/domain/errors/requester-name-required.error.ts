import { DomainError } from '../../../common/errors/domain.error';

export class RequesterNameRequiredError extends DomainError {
  readonly code = 'REQUESTER_NAME_REQUIRED';

  constructor() {
    super(
      'El primer nombre y el primer apellido son obligatorios para registrar un solicitante nuevo.',
    );
  }
}
