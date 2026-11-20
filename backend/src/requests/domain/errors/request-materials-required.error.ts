import { DomainError } from '../../../common/errors/domain.error';

/** RN-04: at least one material of the catalog or one written reference. */
export class RequestMaterialsRequiredError extends DomainError {
  readonly code = 'REQUEST_MATERIALS_REQUIRED';

  constructor() {
    super(
      'Debe seleccionar al menos un material del catálogo o escribir una referencia.',
    );
  }
}
