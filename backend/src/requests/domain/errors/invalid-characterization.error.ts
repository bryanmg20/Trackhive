import { DomainError } from '../../../common/errors/domain.error';

export class InvalidCharacterizationError extends DomainError {
  readonly code = 'INVALID_CHARACTERIZATION';

  constructor() {
    super(
      'Revise el municipio o distrito, el rango de edad y el grupo poblacional.',
    );
  }
}
