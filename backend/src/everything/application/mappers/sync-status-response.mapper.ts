import { SyncStatusResponseDto } from '../dto/sync-status-response.dto';
import type { SyncStatus } from '../dto/sync-status';
import { SyncRunResponseMapper } from './sync-run-response.mapper';

/** The state of the sync for the screen of the administrator (HU-138). */
export class SyncStatusResponseMapper {
  static toDto(status: SyncStatus): SyncStatusResponseDto {
    return {
      enabled: status.enabled,
      currentRun: status.currentRun
        ? {
            ...SyncRunResponseMapper.toDto(status.currentRun),
            expired: status.currentRunExpired,
          }
        : null,
      lastRun: status.lastRun
        ? SyncRunResponseMapper.toDto(status.lastRun)
        : null,
      agentLastContactAt: status.agentLastContactAt?.toISOString() ?? null,
    };
  }
}
