import { DomainError } from '../../../common/errors/domain.error';

/**
 * The administrator only manages staff accounts (PERSONAL or ADMIN), never a
 * public one (HU-05).
 */
export class InvalidStaffRoleError extends DomainError {
  readonly code = 'INVALID_STAFF_ROLE';

  constructor() {
    super('Una cuenta del personal solo puede tener el rol PERSONAL o ADMIN');
  }
}
