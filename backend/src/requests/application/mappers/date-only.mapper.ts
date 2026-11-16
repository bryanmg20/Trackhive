/** A date-only column as YYYY-MM-DD, without time or time zone. */
export class DateOnlyMapper {
  static toDto(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
