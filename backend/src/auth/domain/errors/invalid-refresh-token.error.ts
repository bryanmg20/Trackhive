import { DomainError } from '../../../common/errors/domain.error';

/** Same error for expired, revoked, reused or unknown tokens. */
export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';

  constructor() {
    super('La sesión no es válida o ya expiró');
  }
}
