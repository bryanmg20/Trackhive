import { DesiredDateError } from './errors/desired-date-invalid.error';

export const minimumBusinessDays = 10;

/**
 * Returns today's date in the America/Bogota time zone, as a UTC-midnight Date.
 * Using UTC directly would move the minimum forward after 19:00 in Colombia.
 */
export function todayInBogota(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number);

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

/** The CLENA attends Monday to Saturday. */
export function isAttendedDate(date: Date): boolean {
  return date.getUTCDay() !== 0;
}

/**
 * Adds business days (Monday to Friday). Holidays are not excluded: the
 * business rule says they count as business days.
 */
export function addBusinessDays(from: Date, amount: number): Date {
  const result = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  let added = 0;
  while (added < amount) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() !== 0 && result.getUTCDay() !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Validates the desired date shared by the public and staff registration
 * flows: valid YYYY-MM-DD, at least 10 business days from today, and an
 * attended day (Monday to Saturday).
 */
export function assertValidDesiredDate(
  desiredDate: string,
  now: Date = new Date(),
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desiredDate)) {
    throw new DesiredDateError('La fecha deseada no tiene un formato válido.');
  }

  const desired = new Date(`${desiredDate}T00:00:00Z`);
  if (
    Number.isNaN(desired.getTime()) ||
    desired.toISOString().slice(0, 10) !== desiredDate
  ) {
    throw new DesiredDateError('La fecha deseada no tiene un formato válido.');
  }

  const minimum = addBusinessDays(todayInBogota(now), minimumBusinessDays);
  if (
    !isAttendedDate(desired) ||
    desiredDate < minimum.toISOString().slice(0, 10)
  ) {
    throw new DesiredDateError(
      'La fecha debe tener al menos 10 días hábiles de anticipación y corresponder a un día de atención (lunes a sábado). El CLENA necesita este tiempo para certificar la veracidad del documento.',
    );
  }
}
