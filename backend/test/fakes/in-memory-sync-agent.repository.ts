import type { ISyncAgentRepository } from '../../src/everything/domain/repositories/sync-agent.repository';

/** sync_agent in memory (D-21): the last contact of the agent (HU-138). */
export class InMemorySyncAgentRepository implements ISyncAgentRepository {
  lastContactAt: Date | null = null;
  failRecording: Error | null = null;

  recordContact(at: Date): Promise<void> {
    if (this.failRecording) {
      return Promise.reject(this.failRecording);
    }
    this.lastContactAt = at;
    return Promise.resolve();
  }

  findLastContact(): Promise<Date | null> {
    return Promise.resolve(this.lastContactAt);
  }
}
