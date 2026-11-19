import { InvalidReportPeriodError } from '../errors/invalid-report-period.error';
import { competitionRanks, toReportPeriod } from './report-period';

describe('toReportPeriod', () => {
  it('bounds the whole Bogota days of the range, the last one included', () => {
    expect(toReportPeriod('2026-11-01', '2026-11-30')).toEqual({
      start: new Date('2026-11-01T05:00:00Z'),
      end: new Date('2026-12-01T05:00:00Z'),
    });
  });

  it('accepts a single day', () => {
    expect(toReportPeriod('2026-11-18', '2026-11-18')).toEqual({
      start: new Date('2026-11-18T05:00:00Z'),
      end: new Date('2026-11-19T05:00:00Z'),
    });
  });

  it('leaves open the sides that are not given', () => {
    expect(toReportPeriod()).toEqual({ start: null, end: null });
    expect(toReportPeriod('2026-11-01')).toEqual({
      start: new Date('2026-11-01T05:00:00Z'),
      end: null,
    });
    expect(toReportPeriod(undefined, '2026-11-30')).toEqual({
      start: null,
      end: new Date('2026-12-01T05:00:00Z'),
    });
  });

  it('rejects a start after the end', () => {
    expect(() => toReportPeriod('2026-12-01', '2026-11-30')).toThrow(
      InvalidReportPeriodError,
    );
  });

  it('rejects days that do not exist or are malformed', () => {
    expect(() => toReportPeriod('2026-02-30')).toThrow(
      InvalidReportPeriodError,
    );
    expect(() => toReportPeriod(undefined, '30/11/2026')).toThrow(
      InvalidReportPeriodError,
    );
  });
});

describe('competitionRanks', () => {
  it('gives equal counts the same rank and skips the next ones', () => {
    expect(competitionRanks([9, 5, 5, 3, 3, 3, 1])).toEqual([
      1, 2, 2, 4, 4, 4, 7,
    ]);
  });

  it('handles an empty ranking', () => {
    expect(competitionRanks([])).toEqual([]);
  });
});
