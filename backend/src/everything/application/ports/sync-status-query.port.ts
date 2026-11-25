import type { SyncAgent } from '../../domain/entities/sync-agent.entity';
import type { SyncRun } from '../../domain/entities/sync-run.entity';

/** What is stored about the sync, read at one same moment (HU-138). */
export interface SyncStatusSnapshot {
  // The run PEDIDA or EN_CURSO; there is never more than one
  currentRun: SyncRun | null;
  // The last run that ended, OK or ERROR
  lastRun: SyncRun | null;
  // null until the agent first calls Trackhive
  agent: SyncAgent | null;
}

/**
 * The screen of the sync (HU-138) as a query (D-D): what it shows is a view of
 * several rows of sync_runs and sync_agent, not one entity. Everything is read
 * at one same moment, so a run the agent closes meanwhile shows up either as
 * the current run or as the last one, never as neither.
 */
export interface ISyncStatusQueryService {
  read(): Promise<SyncStatusSnapshot>;
}
