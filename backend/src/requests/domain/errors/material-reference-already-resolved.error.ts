import { DomainError } from '../../../common/errors/domain.error';

/** The reference already has its catalog material (HU-09.2). */
export class MaterialReferenceAlreadyResolvedError extends DomainError {
  readonly code = 'MATERIAL_REFERENCE_ALREADY_RESOLVED';

  constructor() {
    super(
      'La referencia ya tiene un material asociado. Recargue la página para ver el cambio.',
    );
  }
}
