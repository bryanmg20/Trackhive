import { DomainError } from '../../../common/errors/domain.error';

/**
 * The backend has no EVERYTHING_AGENT_TOKEN: the sync with Everything is
 * disabled and the ingest endpoints accept nothing (HU-137). It is an
 * expected state, not a failure of the server, so it is not logged as one.
 */
export class EverythingSyncDisabledError extends DomainError {
  readonly code = 'EVERYTHING_SYNC_DISABLED';

  constructor() {
    super(
      'La sincronización con Everything está desactivada en este servidor: falta configurar el token del agente',
    );
  }
}
