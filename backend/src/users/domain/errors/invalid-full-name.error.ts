import { DomainError } from '../../../common/errors/domain.error';

export class InvalidFullNameError extends DomainError {
  readonly code = 'INVALID_FULL_NAME';

  constructor() {
    super('El nombre completo es obligatorio');
  }
}
