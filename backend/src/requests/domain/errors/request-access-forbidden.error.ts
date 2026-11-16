import { DomainError } from '../../../common/errors/domain.error';

/** A public user asked for a request that is not theirs (HU-17). */
export class RequestAccessForbiddenError extends DomainError {
  readonly code = 'REQUEST_ACCESS_FORBIDDEN';

  constructor() {
    super('No tiene permiso para ver esta solicitud.');
  }
}
