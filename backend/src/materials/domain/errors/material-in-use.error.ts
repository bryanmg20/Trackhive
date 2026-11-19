import { DomainError } from '../../../common/errors/domain.error';

export class MaterialInUseError extends DomainError {
  readonly code = 'MATERIAL_IN_USE';

  constructor(
    message = 'El material está en uso actualmente. Registre primero su devolución.',
  ) {
    super(message);
  }
}
