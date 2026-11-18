import { InvalidAppointmentDateError } from '../errors/invalid-appointment-date.error';
import { InvalidRoomCapacityError } from '../errors/invalid-room-capacity.error';
import { RoomCapacityExceededError } from '../errors/room-capacity-exceeded.error';
import {
  DEFAULT_DAILY_ROOM_CAPACITY,
  MAX_DAILY_ROOM_CAPACITY,
  assertValidDailyCapacity,
  expandOccupancyDateRange,
  fillDailyOccupancy,
  isRoomFull,
  remainingRoomSlots,
} from './room-capacity';

describe('room capacity domain policy', () => {
  it('defaults to 15 appointments per day', () => {
    expect(DEFAULT_DAILY_ROOM_CAPACITY).toBe(15);
  });

  it('accepts positive integers from 1 to PostgreSQL INT4 max', () => {
    expect(() => assertValidDailyCapacity(1)).not.toThrow();
    expect(() => assertValidDailyCapacity(15)).not.toThrow();
    expect(() =>
      assertValidDailyCapacity(MAX_DAILY_ROOM_CAPACITY),
    ).not.toThrow();
  });

  it.each([0, -1, 1.5, Number.NaN, MAX_DAILY_ROOM_CAPACITY + 1])(
    'rejects invalid capacity %s',
    (value) => {
      expect(() => assertValidDailyCapacity(value)).toThrow(
        InvalidRoomCapacityError,
      );
    },
  );

  it('detects full room and remaining slots', () => {
    expect(isRoomFull(14, 15)).toBe(false);
    expect(isRoomFull(15, 15)).toBe(true);
    expect(isRoomFull(18, 15)).toBe(true);
    expect(remainingRoomSlots(14, 15)).toBe(1);
    expect(remainingRoomSlots(18, 15)).toBe(0);
  });

  it('expands date ranges and fills missing days with zero', () => {
    const { isoDays } = expandOccupancyDateRange('2026-11-18', '2026-11-20');
    expect(isoDays).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
    expect(
      fillDailyOccupancy(isoDays, [{ date: '2026-11-19', occupied: 4 }]),
    ).toEqual([
      { date: '2026-11-18', occupied: 0 },
      { date: '2026-11-19', occupied: 4 },
      { date: '2026-11-20', occupied: 0 },
    ]);
  });

  it('rejects inverted or oversized occupancy ranges', () => {
    expect(() => expandOccupancyDateRange('2026-11-21', '2026-11-20')).toThrow(
      InvalidAppointmentDateError,
    );
    expect(() => expandOccupancyDateRange('2026-01-01', '2026-04-01')).toThrow(
      InvalidAppointmentDateError,
    );
    expect(() => expandOccupancyDateRange('2026-02-30', '2026-03-01')).toThrow(
      InvalidAppointmentDateError,
    );
  });

  it('formats a descriptive message on RoomCapacityExceededError', () => {
    const error = new RoomCapacityExceededError(
      new Date('2026-11-20T00:00:00Z'),
      15,
    );
    expect(error.code).toBe('ROOM_CAPACITY_EXCEEDED');
    expect(error.message).toContain('15 citas');
    expect(error.message).toContain('2026');
  });
});
