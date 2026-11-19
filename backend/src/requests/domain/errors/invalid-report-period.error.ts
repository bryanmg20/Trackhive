import { DomainError } from '../../../common/errors/domain.error';

/** The date range of a report is not valid (HU-26). */
export class InvalidReportPeriodError extends DomainError {
  readonly code = 'INVALID_REPORT_PERIOD';

  constructor(message: string) {
    super(message);
  }
}
