import type {
  ISyncStatusQueryService,
  SyncStatusSnapshot,
} from '../../src/everything/application/ports/sync-status-query.port';
import type { InMemorySyncAgentRepository } from './in-memory-sync-agent.repository';
import type { InMemorySyncRunRepository } from './in-memory-sync-run.repository';

/**
 * The screen of the sync (HU-138) read from the repositories in memory, as
 * PrismaSyncStatusQueryService reads sync_runs and sync_agent (D-21).
 */
export class InMemorySyncStatusQuery implements ISyncStatusQueryService {
  constructor(
    private readonly runs: InMemorySyncRunRepository,
    private readonly agents: InMemorySyncAgentRepository,
  ) {}

  read(): Promise<SyncStatusSnapshot> {
    const all = [...this.runs.runs.values()];
    const [lastRun] = all
      .filter((run) => run.status === 'OK' || run.status === 'ERROR')
      .sort(
        (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      );
    return Promise.resolve({
      currentRun: all.find((run) => run.isRequested || run.isRunning) ?? null,
      lastRun: lastRun ?? null,
      agent: this.agents.agent,
    });
  }
}
