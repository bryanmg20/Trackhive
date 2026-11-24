/**
 * A run of the Everything sync (HU-137) is EN_CURSO while the agent sends its
 * pages, and ends OK (closed complete) or ERROR (closed with an error, or
 * expired). Only one run can be EN_CURSO at a time.
 */
export const SYNC_RUN_STATUSES = ['EN_CURSO', 'OK', 'ERROR'] as const;

export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

/** How the agent closes a run: complete or with an error. */
export const SYNC_RUN_RESULTS = [
  'OK',
  'ERROR',
] as const satisfies readonly SyncRunStatus[];

export type SyncRunResult = (typeof SYNC_RUN_RESULTS)[number];

export function isSyncRunStatus(value: string): value is SyncRunStatus {
  return (SYNC_RUN_STATUSES as readonly string[]).includes(value);
}
