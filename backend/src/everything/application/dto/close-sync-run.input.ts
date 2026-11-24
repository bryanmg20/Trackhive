import type { SyncRunResult } from '../../domain/enums/sync-run-status';

/** How the agent closes a run (HU-137). */
export interface CloseSyncRunInput {
  runId: string;
  // OK: complete and without errors; ERROR: something failed
  result: SyncRunResult;
  // With OK: how many pages the agent sent, numbered from 1
  pageCount?: number;
  // With ERROR: what failed, for sync_runs.error_message
  errorMessage?: string;
}
