import { DomainError } from '../../../common/errors/domain.error';

export class InvalidPasswordHashError extends DomainError {
  readonly code = 'INVALID_PASSWORD_HASH';

  constructor() {
    super('La contraseña no tiene un hash válido');
  }
}
