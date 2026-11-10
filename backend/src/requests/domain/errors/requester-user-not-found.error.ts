import { DomainError } from '../../../common/errors/domain.error';

export class RequesterUserNotFoundError extends DomainError {
  readonly code = 'REQUESTER_USER_NOT_FOUND';

  constructor() {
    super('El usuario asociado a la solicitud no existe.');
  }
}
