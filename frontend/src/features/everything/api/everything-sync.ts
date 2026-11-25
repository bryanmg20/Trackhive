import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import {
  networkRequestApiError,
  readRequestApiError,
} from '../../requests/api/request-api-error';

/**
 * PEDIDA: waits for the agent of the CLENA to take it (HU-138); EN_CURSO: the
 * agent is sending the folders; OK and ERROR: how it ended (HU-137).
 */
export type SyncRunStatus = 'PEDIDA' | 'EN_CURSO' | 'OK' | 'ERROR';

/** A run of the sync with Everything. Dates in ISO 8601, UTC. */
export interface SyncRun {
  id: string;
  status: SyncRunStatus;
  // When an administrator asked for it with «Sincronizar ahora»; null if
  // the agent started it on its own (its daily run)
  requestedAt: string | null;
  // null while PEDIDA
  startedAt: string | null;
  lastActivityAt: string;
  // null while PEDIDA or EN_CURSO
  finishedAt: string | null;
  // Folders Everything sent in the run
  filesCount: number;
  errorMessage: string | null;
}

export interface CurrentSyncRun extends SyncRun {
  // EN_CURSO, but the agent sent nothing for longer than the server allows:
  // asking for another sync ends it with an error
  expired: boolean;
}

export interface SyncStatus {
  // false: the server has no EVERYTHING_AGENT_TOKEN, nothing can be asked for
  enabled: boolean;
  // PEDIDA or EN_CURSO; never more than one
  currentRun: CurrentSyncRun | null;
  // The last run that ended, OK or ERROR
  lastRun: SyncRun | null;
  agentLastContactAt: string | null;
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(apiUrl(path), init);
  } catch {
    throw networkRequestApiError();
  }
  if (!response.ok) {
    throw await readRequestApiError(response);
  }
  return (await response.json()) as T;
}

/** Calls the HU-138 endpoint `GET /api/v1/everything/sync-status` (ADMIN only). */
export function getSyncStatus(): Promise<SyncStatus> {
  return send<SyncStatus>('/api/v1/everything/sync-status', {
    headers: { Accept: 'application/json' },
  });
}

/**
 * «Sincronizar ahora»: calls the HU-138 endpoint
 * `POST /api/v1/everything/sync-requests` (ADMIN only). The answer is the run
 * PEDIDA; 409 when one is already requested or running, 503 when the
 * integration is disabled.
 */
export function requestSync(): Promise<SyncRun> {
  return send<SyncRun>('/api/v1/everything/sync-requests', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
}
