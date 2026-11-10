import { DomainError } from '../../../common/errors/domain.error';

export class RequestNotFoundError extends DomainError {
  readonly code = 'REQUEST_NOT_FOUND';

  constructor() {
    super('La solicitud no existe.');
  }
}
