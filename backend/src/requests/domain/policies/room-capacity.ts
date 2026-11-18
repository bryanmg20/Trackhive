import { InvalidAppointmentDateError } from '../errors/invalid-appointment-date.error';
import { InvalidRoomCapacityError } from '../errors/invalid-room-capacity.error';
import type { DayOccupancyCount } from '../value-objects/room-capacity';

/** Default daily capacity when no configuration has been saved (HU-20.1). */
export const DEFAULT_DAILY_ROOM_CAPACITY = 15;

/** Maximum positive 32-bit signed integer supported by PostgreSQL INTEGER. */
export const MAX_DAILY_ROOM_CAPACITY = 2147483647;

/** Maximum number of days returned in one occupancy query (calendar grid). */
export const MAX_OCCUPANCY_RANGE_DAYS = 62;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Appointment statuses that occupy a daily slot in the reading room.
 * CANCELADA and NO_ASISTIO release their slot (HU-20.1).
 */
export const ACTIVE_CAPACITY_APPOINTMENT_STATUSES = [
  'PROGRAMADA',
  'CUMPLIDA',
] as const;

/** Validates that a daily room capacity is an integer between 1 and 2^31 - 1. */
export function assertValidDailyCapacity(capacity: number): void {
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > MAX_DAILY_ROOM_CAPACITY
  ) {
    throw new InvalidRoomCapacityError(
      capacity > MAX_DAILY_ROOM_CAPACITY
        ? `La capacidad diaria no puede superar ${MAX_DAILY_ROOM_CAPACITY}.`
        : 'La capacidad diaria debe ser un número entero mayor que 0.',
    );
  }
}

export function isRoomFull(
  occupiedSlots: number,
  dailyCapacity: number,
): boolean {
  return occupiedSlots >= dailyCapacity;
}

export function remainingRoomSlots(
  occupiedSlots: number,
  dailyCapacity: number,
): number {
  return Math.max(0, dailyCapacity - occupiedSlots);
}

function parseDateOnlyUtc(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !DATE_ONLY_PATTERN.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new InvalidAppointmentDateError(
      'La fecha debe tener el formato YYYY-MM-DD.',
    );
  }
  return date;
}

/** Validates a YYYY-MM-DD range and enumerates every day inside it. */
export function expandOccupancyDateRange(
  from: string,
  to: string,
): { fromDate: Date; toDate: Date; isoDays: string[] } {
  const fromDate = parseDateOnlyUtc(from);
  const toDate = parseDateOnlyUtc(to);
  if (fromDate.getTime() > toDate.getTime()) {
    throw new InvalidAppointmentDateError(
      'La fecha inicial no puede ser posterior a la fecha final.',
    );
  }
  const daySpan =
    Math.round((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY) + 1;
  if (daySpan > MAX_OCCUPANCY_RANGE_DAYS) {
    throw new InvalidAppointmentDateError(
      `El rango de consulta no puede superar ${MAX_OCCUPANCY_RANGE_DAYS} días.`,
    );
  }
  const isoDays: string[] = [];
  for (let offset = 0; offset < daySpan; offset += 1) {
    isoDays.push(
      new Date(fromDate.getTime() + offset * MS_PER_DAY)
        .toISOString()
        .slice(0, 10),
    );
  }
  return { fromDate, toDate, isoDays };
}

/** Fills missing dates in [isoDays] with occupied = 0. */
export function fillDailyOccupancy(
  isoDays: readonly string[],
  counts: readonly DayOccupancyCount[],
): DayOccupancyCount[] {
  const byDate = new Map(counts.map((item) => [item.date, item.occupied]));
  return isoDays.map((date) => ({
    date,
    occupied: byDate.get(date) ?? 0,
  }));
}
