import { DomainError } from '../../../common/errors/domain.error';

/** A stored run with a status that is not EN_CURSO, OK or ERROR. */
export class InvalidSyncRunStatusError extends DomainError {
  readonly code = 'INVALID_SYNC_RUN_STATUS';

  constructor() {
    super('El estado de la corrida de sincronización no es válido');
  }
}
