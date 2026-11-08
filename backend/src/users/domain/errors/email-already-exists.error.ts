import { DomainError } from '../../../common/errors/domain.error';

export class EmailAlreadyExistsError extends DomainError {
  readonly code = 'EMAIL_ALREADY_EXISTS';

  constructor() {
    super('Ya existe una cuenta con ese correo');
  }
}
