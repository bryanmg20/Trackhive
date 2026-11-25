import { describe, expect, it } from 'vitest';
import { dateTime, timeAgo } from './sync-times';

const NOW = Date.parse('2026-11-24T20:00:00.000Z');
const before = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;

describe('times of the screen of the sync (HU-138)', () => {
  it.each([
    [before(10_000), 'hace unos segundos'],
    [before(MINUTE), 'hace 1 minuto'],
    [before(15 * MINUTE + 40_000), 'hace 15 minutos'],
    [before(60 * MINUTE), 'hace 1 hora'],
    [before(5 * 60 * MINUTE + 59 * MINUTE), 'hace 5 horas'],
    [before(24 * 60 * MINUTE), 'hace 1 día'],
    [before(3 * 24 * 60 * MINUTE + 5 * 60 * MINUTE), 'hace 3 días'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected);
  });

  it('a moment a little ahead (another clock) is «hace unos segundos»', () => {
    expect(timeAgo(new Date(NOW + 5_000).toISOString(), NOW)).toBe(
      'hace unos segundos',
    );
  });

  it('shows the exact date in the time zone of the CLENA (UTC-5)', () => {
    // 20:05 UTC is 3:05 p. m. in Bogotá
    expect(dateTime('2026-11-24T20:05:00.000Z')).toMatch(/24\/11\/2026/);
    expect(dateTime('2026-11-24T20:05:00.000Z')).toMatch(/3:05/);
  });
});
