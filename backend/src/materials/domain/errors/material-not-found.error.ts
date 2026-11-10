import { DomainError } from '../../../common/errors/domain.error';

export class MaterialNotFoundError extends DomainError {
  readonly code = 'MATERIAL_NOT_FOUND';

  constructor() {
    super('El material no existe.');
  }
}
