import { DomainError } from '../../../common/errors/domain.error';

export class InvalidMaterialTypeError extends DomainError {
  readonly code = 'INVALID_MATERIAL_TYPE';

  constructor() {
    super('El tipo de material no es válido');
  }
}
