import type { SyncRun } from '../../domain/entities/sync-run.entity';

/** What the screen of the sync shows (HU-138), before it is mapped. */
export interface SyncStatus {
  // EVERYTHING_AGENT_TOKEN is configured
  enabled: boolean;
  // The run PEDIDA or EN_CURSO; there is never more than one
  currentRun: SyncRun | null;
  // currentRun is EN_CURSO without pages for longer than the timeout
  currentRunExpired: boolean;
  // The last run that ended, OK or ERROR
  lastRun: SyncRun | null;
  agentLastContactAt: Date | null;
}
