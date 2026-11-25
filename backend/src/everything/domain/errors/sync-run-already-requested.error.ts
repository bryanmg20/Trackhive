import { DomainError } from '../../../common/errors/domain.error';

/**
 * An administrator asked for «Sincronizar ahora» while another run waits for
 * the agent (HU-138): no other one is asked for.
 */
export class SyncRunAlreadyRequestedError extends DomainError {
  readonly code = 'SYNC_RUN_ALREADY_REQUESTED';

  constructor() {
    super(
      'Ya hay una sincronización pedida que espera al agente del CLENA, así que no se pidió otra. ' +
        'El agente la tomará la próxima vez que consulte a Trackhive.',
    );
  }
}
