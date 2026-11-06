import { DomainError } from '../../../common/errors/domain.error';

export class InvalidRoleError extends DomainError {
  readonly code = 'INVALID_ROLE';

  constructor() {
    super('El rol del usuario no es válido');
  }
}
