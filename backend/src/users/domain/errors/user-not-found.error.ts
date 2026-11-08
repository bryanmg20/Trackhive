import { DomainError } from '../../../common/errors/domain.error';

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('El usuario no existe');
  }
}
