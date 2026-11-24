import { DomainError } from '../../../common/errors/domain.error';

/**
 * The page the agent sent brings more results than the limit (HU-137): it is
 * rejected whole, nothing of it is saved.
 */
export class EverythingPageTooLargeError extends DomainError {
  readonly code = 'EVERYTHING_PAGE_TOO_LARGE';

  constructor(
    readonly results: number,
    readonly maxResults: number,
  ) {
    super(
      `La página de Everything trae ${results} resultados y el máximo es ${maxResults}.`,
    );
  }
}
