import { DomainError } from '../../../common/errors/domain.error';

export class InvalidMaterialReviewReasonError extends DomainError {
  readonly code = 'INVALID_MATERIAL_REVIEW_REASON';

  constructor() {
    super('El motivo de revisión del material no es válido');
  }
}
