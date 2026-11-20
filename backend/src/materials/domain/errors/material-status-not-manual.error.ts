import { DomainError } from '../../../common/errors/domain.error';

export class MaterialStatusNotManualError extends DomainError {
  readonly code = 'MATERIAL_STATUS_NOT_MANUAL';

  constructor() {
    super(
      'El estado EN_USO solo puede cambiarse mediante el registro de entrega y devolución del material.',
    );
  }
}
