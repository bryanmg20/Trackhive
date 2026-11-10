import { DomainError } from '../../../common/errors/domain.error';

export class RequesterEmailMismatchError extends DomainError {
  readonly code = 'REQUESTER_EMAIL_MISMATCH';

  constructor() {
    super('El correo del solicitante no coincide con el usuario asociado.');
  }
}
