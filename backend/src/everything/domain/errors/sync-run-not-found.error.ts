import { DomainError } from '../../../common/errors/domain.error';

export class SyncRunNotFoundError extends DomainError {
  readonly code = 'SYNC_RUN_NOT_FOUND';

  constructor() {
    super('La corrida de sincronización no existe.');
  }
}
