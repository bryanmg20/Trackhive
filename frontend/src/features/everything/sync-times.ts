const RELATIVE = new Intl.RelativeTimeFormat('es-CO', { numeric: 'always' });

// The dates of the server are UTC; they are shown in the time zone of the
// CLENA (D-18)
const ABSOLUTE = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago `iso` was, as the screen of the sync says it (HU-138):
 * «hace unos segundos», «hace 15 minutos», «hace 2 horas», «hace 3 días».
 * A moment slightly ahead (another clock) is «hace unos segundos».
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) {
    return 'hace unos segundos';
  }
  if (elapsed < HOUR) {
    return RELATIVE.format(-Math.floor(elapsed / MINUTE), 'minute');
  }
  if (elapsed < DAY) {
    return RELATIVE.format(-Math.floor(elapsed / HOUR), 'hour');
  }
  return RELATIVE.format(-Math.floor(elapsed / DAY), 'day');
}

/** «24/11/2026, 3:05 p. m.», in America/Bogota. */
export function dateTime(iso: string): string {
  return ABSOLUTE.format(new Date(iso));
}
