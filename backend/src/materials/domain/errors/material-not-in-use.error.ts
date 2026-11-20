import { DomainError } from '../../../common/errors/domain.error';

export class MaterialNotInUseError extends DomainError {
  readonly code = 'MATERIAL_NOT_IN_USE';

  constructor() {
    super(
      'El material no está en uso ni tiene una entrega pendiente de devolución.',
    );
  }
}
