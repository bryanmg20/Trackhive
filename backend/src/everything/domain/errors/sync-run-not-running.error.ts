import { DomainError } from '../../../common/errors/domain.error';

/** The run already ended (OK or ERROR): it takes no more pages (HU-137). */
export class SyncRunNotRunningError extends DomainError {
  readonly code = 'SYNC_RUN_NOT_RUNNING';

  constructor() {
    super('La corrida de sincronización ya terminó y no recibe más páginas.');
  }
}
