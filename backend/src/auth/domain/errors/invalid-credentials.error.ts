import { DomainError } from '../../../common/errors/domain.error';

/** Same error for unknown email and wrong password: never reveal which failed. */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Correo o contraseña incorrectos');
  }
}
