import { InvalidReportPeriodError } from '../errors/invalid-report-period.error';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// America/Bogota has no daylight saving time: it is always UTC-5 (D-18)
const BOGOTA_OFFSET = '-05:00';

/**
 * The instants that bound a report period. `start` is included and `end` is
 * excluded; null means that side of the range is open.
 */
export interface ReportPeriod {
  start: Date | null;
  end: Date | null;
}

function startOfBogotaDay(value: string, label: string): Date {
  const date = new Date(`${value}T00:00:00${BOGOTA_OFFSET}`);
  const sameDay = new Date(`${value}T00:00:00Z`);
  if (
    !DATE_ONLY_PATTERN.test(value) ||
    Number.isNaN(date.getTime()) ||
    sameDay.toISOString().slice(0, 10) !== value
  ) {
    throw new InvalidReportPeriodError(
      `La fecha ${label} debe tener el formato YYYY-MM-DD.`,
    );
  }
  return date;
}

/**
 * Turns the days the staff picks (YYYY-MM-DD, both included, in
 * America/Bogota) into the instants that bound `registered_at` (HU-26).
 */
export function toReportPeriod(from?: string, to?: string): ReportPeriod {
  const start = from ? startOfBogotaDay(from, 'inicial') : null;
  const toStart = to ? startOfBogotaDay(to, 'final') : null;
  if (start && toStart && start.getTime() > toStart.getTime()) {
    throw new InvalidReportPeriodError(
      'La fecha inicial no puede ser posterior a la fecha final.',
    );
  }
  const end = toStart
    ? new Date(toStart.getTime() + 24 * 60 * 60 * 1000)
    : null;
  return { start, end };
}

/**
 * Standard competition ranking of counts already sorted from highest to
 * lowest: equal counts share a rank and the next one skips (1, 2, 2, 4).
 */
export function competitionRanks(sortedCounts: readonly number[]): number[] {
  return sortedCounts.map((count, index) =>
    index > 0 && sortedCounts[index - 1] === count
      ? sortedCounts.indexOf(count) + 1
      : index + 1,
  );
}
