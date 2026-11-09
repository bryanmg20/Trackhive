import { DomainError } from '../../../common/errors/domain.error';

export class RequestMaterialNotFoundError extends DomainError {
  readonly code = 'REQUEST_MATERIAL_NOT_FOUND';

  constructor() {
    super('Uno o más materiales seleccionados no existen.');
  }
}
