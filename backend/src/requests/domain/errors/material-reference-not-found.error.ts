import { DomainError } from '../../../common/errors/domain.error';

export class MaterialReferenceNotFoundError extends DomainError {
  readonly code = 'MATERIAL_REFERENCE_NOT_FOUND';

  constructor() {
    super('La referencia no existe en esta solicitud.');
  }
}
