import { DomainError } from '../../../common/errors/domain.error';
export class LastAdminCannotBeDeletedError extends DomainError {
  readonly code = 'LAST_ADMIN_CANNOT_BE_DELETED';
  constructor() {
    super(
      'No puede eliminar la última cuenta ADMIN activa. Debe existir otro administrador activo.',
    );
  }
}
