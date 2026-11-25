import { SyncAgent } from '../../src/everything/domain/entities/sync-agent.entity';
import type { ISyncAgentRepository } from '../../src/everything/domain/repositories/sync-agent.repository';

/** sync_agent in memory (D-21): the agent of the CLENA (HU-138). */
export class InMemorySyncAgentRepository implements ISyncAgentRepository {
  agent: SyncAgent | null = null;
  failSaving: Error | null = null;

  save(agent: SyncAgent): Promise<void> {
    if (this.failSaving) {
      return Promise.reject(this.failSaving);
    }
    this.agent = agent;
    return Promise.resolve();
  }
}
