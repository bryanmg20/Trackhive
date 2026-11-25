import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { RecordAgentContactUseCase } from '../../application/use-cases/record-agent-contact.use-case';

/**
 * Every call of the agent that passes EverythingAgentGuard is a contact
 * (HU-138): asking whether a run is requested, or starting, feeding or
 * closing one. It is recorded before the endpoint runs, so a call that then
 * answers an error counts too. Recording it never stops the call: if it
 * fails, the log says so and the sync goes on.
 */
@Injectable()
export class AgentContactInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AgentContactInterceptor.name);

  constructor(private readonly recordContact: RecordAgentContactUseCase) {}

  async intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      await this.recordContact.execute();
    } catch (error) {
      this.logger.warn(
        `Could not record the contact of the Everything agent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return next.handle();
  }
}
