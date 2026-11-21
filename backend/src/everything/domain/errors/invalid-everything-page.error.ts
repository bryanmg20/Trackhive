import { DomainError } from '../../../common/errors/domain.error';

/**
 * The page of Everything that the agent (HU-166) sent does not have the shape
 * of the HTTP server: the whole page is rejected, never a part of it (HU-135).
 */
export class InvalidEverythingPageError extends DomainError {
  readonly code = 'INVALID_EVERYTHING_PAGE';

  constructor(readonly reason: string) {
    super(`Página de Everything inválida: ${reason}`);
  }
}
