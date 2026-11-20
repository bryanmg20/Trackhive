import { DomainError } from '../../../common/errors/domain.error';

/** A written reference without the data its kind requires (HU-09.2). */
export class InvalidMaterialReferenceError extends DomainError {
  readonly code = 'INVALID_MATERIAL_REFERENCE';

  constructor(message: string) {
    super(message);
  }
}
