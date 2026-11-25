/**
 * A run of the Everything sync (HU-137) is EN_CURSO while the agent sends its
 * pages, and ends OK (closed complete) or ERROR (closed with an error, or
 * expired). An administrator may ask for one with «Sincronizar ahora»
 * (HU-138): it is PEDIDA until the agent takes it. Only one run can be PEDIDA
 * or EN_CURSO at a time.
 */
export const SYNC_RUN_STATUSES = ['PEDIDA', 'EN_CURSO', 'OK', 'ERROR'] as const;

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
