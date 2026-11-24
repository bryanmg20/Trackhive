import { DomainError } from '../../../common/errors/domain.error';

/**
 * Another run is open and has not expired (HU-137): two syncs never run at
 * once, even with two instances of the backend.
 */
export class SyncRunAlreadyRunningError extends DomainError {
  readonly code = 'SYNC_RUN_ALREADY_RUNNING';

  constructor() {
    super(
      'Ya hay una sincronización con Everything en curso. Espera a que termine o a que venza.',
    );
  }
}
