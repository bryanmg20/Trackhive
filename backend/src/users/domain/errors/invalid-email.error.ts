import { DomainError } from '../../../common/errors/domain.error';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';

  constructor() {
    super('El correo no tiene un formato válido');
  }
}
