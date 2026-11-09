import { DomainError } from '../../../common/errors/domain.error';

export class DesiredDateError extends DomainError {
  readonly code = 'INVALID_DESIRED_DATE';

  constructor(message: string) {
    super(message);
  }
}
