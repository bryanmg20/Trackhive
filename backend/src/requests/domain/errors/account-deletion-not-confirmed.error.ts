import { DomainError } from '../../../common/errors/domain.error';
export class AccountDeletionNotConfirmedError extends DomainError {
  readonly code = 'ACCOUNT_DELETION_NOT_CONFIRMED';
  constructor() {
    super('Debe confirmar la eliminación de su cuenta');
  }
}
