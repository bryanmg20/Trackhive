import { DomainError } from '../../../common/errors/domain.error';

// Days are stored as UTC midnight, so they are formatted in UTC.
const DAY_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Thrown when scheduling an appointment on a day that already reached the
 * configured daily capacity of the reading room (HU-20.1, RN-19).
 */
export class RoomCapacityExceededError extends DomainError {
  readonly code = 'ROOM_CAPACITY_EXCEEDED';

  constructor(date: Date, dailyCapacity: number) {
    super(
      `La sala de consulta alcanzó su capacidad máxima de ${dailyCapacity} ` +
        `citas para el ${DAY_FORMAT.format(date)}.`,
    );
  }
}
