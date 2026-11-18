import { DomainError } from '../../../common/errors/domain.error';

/**
 * Thrown when the daily capacity of the reading room is not a positive
 * 32-bit integer (HU-20.1).
 */
export class InvalidRoomCapacityError extends DomainError {
  readonly code = 'INVALID_ROOM_CAPACITY';

  constructor(
    message = 'La capacidad diaria debe ser un número entero mayor que 0.',
  ) {
    super(message);
  }
}
