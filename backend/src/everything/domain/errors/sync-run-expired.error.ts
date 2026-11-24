import { DomainError } from '../../../common/errors/domain.error';

/**
 * The run spent more than EVERYTHING_RUN_TIMEOUT_MINUTES without pages (the
 * agent stopped or lost the connection): it ended with an error (HU-137).
 */
export class SyncRunExpiredError extends DomainError {
  readonly code = 'SYNC_RUN_EXPIRED';

  constructor(readonly timeoutMinutes: number) {
    super(
      `La corrida de sincronización venció: pasó más de ${timeoutMinutes} minutos sin recibir páginas.`,
    );
  }
}
