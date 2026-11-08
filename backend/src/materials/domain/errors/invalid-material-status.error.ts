import { DomainError } from '../../../common/errors/domain.error';

export class InvalidMaterialStatusError extends DomainError {
  readonly code = 'INVALID_MATERIAL_STATUS';

  constructor() {
    super('El estado del material no es válido');
  }
}
