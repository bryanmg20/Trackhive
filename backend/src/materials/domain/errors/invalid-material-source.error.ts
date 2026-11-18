import { DomainError } from '../../../common/errors/domain.error';

export class InvalidMaterialSourceError extends DomainError {
  readonly code = 'INVALID_MATERIAL_SOURCE';

  constructor() {
    super('El origen del material no es válido');
  }
}
