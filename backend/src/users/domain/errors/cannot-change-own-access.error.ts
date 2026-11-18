import { DomainError } from '../../../common/errors/domain.error';

/**
 * An administrator cannot deactivate their own account: they would lose
 * access to the system (HU-05).
 */
export class CannotChangeOwnAccessError extends DomainError {
  readonly code = 'CANNOT_CHANGE_OWN_ACCESS';

  constructor() {
    super('No puede desactivar su propia cuenta');
  }
}
