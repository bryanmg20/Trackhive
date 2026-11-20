import { DomainError } from '../../../common/errors/domain.error';

/** Only a request still being searched gets a material for its reference. */
export class MaterialReferenceNotResolvableError extends DomainError {
  readonly code = 'MATERIAL_REFERENCE_NOT_RESOLVABLE';

  constructor() {
    super(
      'Solo se puede asociar un material a una referencia de una solicitud Recibida o En búsqueda.',
    );
  }
}
