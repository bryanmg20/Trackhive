import { DomainError } from '../../../common/errors/domain.error';
import type {
  MaterialConflict,
  UnbookableMaterialStatus,
} from '../material-availability';

const STATUS_TEXT: Record<UnbookableMaterialStatus, string> = {
  EN_RESTAURACION: 'está en restauración',
  NO_CONSULTABLE: 'no es consultable',
};

// Date-only value at UTC midnight: format it in UTC so no time zone moves it
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
});

/** 2026-11-20 -> "viernes 20/11/2026". */
function formatDay(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split('-');
  return `${WEEKDAY_FORMAT.format(date)} ${day}/${month}/${year}`;
}

function describeConflict(conflict: MaterialConflict): string {
  const material = `${conflict.catalogCode} · ${conflict.title}`;
  return conflict.reason === 'BOOKED'
    ? `${material} ya tiene una cita ese día (solicitud ${conflict.trackingCode})`
    : `${material} ${STATUS_TEXT[conflict.status]}`;
}

/**
 * A material of the request cannot be scheduled on the day of the
 * appointment (HU-20): it already has an appointment that day, or it is in
 * restoration or not consultable. Nothing is saved.
 */
export class MaterialUnavailableError extends DomainError {
  readonly code = 'MATERIAL_UNAVAILABLE';

  private constructor(message: string) {
    super(message);
  }

  /** Names every conflict, so the staff knows what to change. */
  static forConflicts(
    conflicts: readonly MaterialConflict[],
    date: Date,
  ): MaterialUnavailableError {
    return new MaterialUnavailableError(
      `No se puede agendar la cita del ${formatDay(date)}: ` +
        `${conflicts.map(describeConflict).join('; ')}.`,
    );
  }

  /**
   * The database refused the booking: someone else scheduled one of the
   * materials for that day between the check and the save (D-09).
   */
  static concurrentBooking(): MaterialUnavailableError {
    return new MaterialUnavailableError(
      'Otra persona acaba de agendar uno de estos materiales para ese día. ' +
        'Recargue la página e inténtelo de nuevo.',
    );
  }
}
