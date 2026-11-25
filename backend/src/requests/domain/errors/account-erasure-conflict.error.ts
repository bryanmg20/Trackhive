import { DomainError } from '../../../common/errors/domain.error';
export class AccountErasureConflictError extends DomainError {
  readonly code = 'ACCOUNT_ERASURE_CONFLICT';
  constructor() {
    super(
      'Otra operación modificó los datos durante la eliminación. No se completó la eliminación; vuelva a intentarlo.',
    );
  }
}
