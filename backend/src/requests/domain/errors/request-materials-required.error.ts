import { DomainError } from '../../../common/errors/domain.error';

export class RequestMaterialsRequiredError extends DomainError {
  readonly code = 'REQUEST_MATERIALS_REQUIRED';

  constructor() {
    super('Debe seleccionar al menos un material.');
  }
}
