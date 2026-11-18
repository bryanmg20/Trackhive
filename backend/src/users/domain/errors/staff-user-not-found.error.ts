import { DomainError } from '../../../common/errors/domain.error';

/**
 * No staff account has that id. A public account is not managed by the
 * administrator either, so it gets the same error (HU-05).
 */
export class StaffUserNotFoundError extends DomainError {
  readonly code = 'STAFF_USER_NOT_FOUND';

  constructor() {
    super('La cuenta del personal no existe');
  }
}
