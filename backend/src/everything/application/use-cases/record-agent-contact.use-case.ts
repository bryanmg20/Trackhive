import { Inject, Injectable } from '@nestjs/common';
import type { ISyncAgentRepository } from '../../domain/repositories/sync-agent.repository';
import { SYNC_AGENT_REPOSITORY } from '../tokens';

/**
 * The agent of the CLENA called Trackhive with its token (HU-138): to ask for
 * a requested run, or to start, feed or close one. The screen of the sync
 * shows when it last did, so the administrator knows whether the PC is on.
 */
@Injectable()
export class RecordAgentContactUseCase {
  constructor(
    @Inject(SYNC_AGENT_REPOSITORY)
    private readonly agent: ISyncAgentRepository,
  ) {}

  execute(): Promise<void> {
    return this.agent.recordContact(new Date());
  }
}
