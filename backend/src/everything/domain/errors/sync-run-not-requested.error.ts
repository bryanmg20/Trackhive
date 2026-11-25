import { DomainError } from '../../../common/errors/domain.error';

/**
 * The agent can only take a run that waits PEDIDA (HU-138): one that already
 * started or ended is not taken again.
 */
export class SyncRunNotRequestedError extends DomainError {
  readonly code = 'SYNC_RUN_NOT_REQUESTED';

  constructor() {
    super(
      'La corrida de sincronización no está pedida: el agente no puede tomarla.',
    );
  }
}
