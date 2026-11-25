import { SyncAgent } from '../entities/sync-agent.entity';

/**
 * The agent of the CLENA as Trackhive knows it (HU-138), in a single row,
 * sync_agent. The screen of the sync reads it with the rest of its state
 * through ISyncStatusQueryService, so the repository only saves it.
 */
export interface ISyncAgentRepository {
  /** Saves the agent: the first contact creates the row, the next ones update it. */
  save(agent: SyncAgent): Promise<void>;
}
