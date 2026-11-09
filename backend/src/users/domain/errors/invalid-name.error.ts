import { DomainError } from '../../../common/errors/domain.error';
import { NAME_MAX_LENGTH, type NameField } from '../person-name';

const FIELD_LABELS: Record<NameField, string> = {
  firstName: 'El primer nombre',
  middleName: 'El segundo nombre',
  lastName: 'El primer apellido',
  secondLastName: 'El segundo apellido',
};

export type InvalidNameReason = 'REQUIRED' | 'TOO_LONG';

/** One of the four name fields is missing or too long. */
export class InvalidNameError extends DomainError {
  readonly code = 'INVALID_NAME';

  constructor(
    readonly field: NameField,
    reason: InvalidNameReason,
  ) {
    super(
      reason === 'REQUIRED'
        ? `${FIELD_LABELS[field]} es obligatorio`
        : `${FIELD_LABELS[field]} no puede superar los ${NAME_MAX_LENGTH} caracteres`,
    );
  }
}
