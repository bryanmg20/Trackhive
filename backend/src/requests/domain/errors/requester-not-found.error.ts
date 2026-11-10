import { DomainError } from '../../../common/errors/domain.error';

export class RequesterNotFoundError extends DomainError {
  readonly code = 'REQUESTER_NOT_FOUND';

  constructor() {
    super('No existe un solicitante registrado con ese correo.');
  }
}
