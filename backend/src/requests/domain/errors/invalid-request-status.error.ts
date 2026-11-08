import { DomainError } from '../../../common/errors/domain.error';

export class InvalidRequestStatusError extends DomainError {
  readonly code = 'INVALID_REQUEST_STATUS';

  constructor() {
    super('El estado de la solicitud no es válido');
  }
}
