import { DomainError } from '../../../common/errors/domain.error';

/**
 * The call to an ingest endpoint has no token of the Everything agent, or
 * another one (HU-137). Like InvalidCredentialsError, it answers 401.
 */
export class InvalidAgentTokenError extends DomainError {
  readonly code = 'INVALID_AGENT_TOKEN';

  constructor() {
    super('Falta el token del agente de Everything o no es válido');
  }
}
