import { Inject, Injectable } from '@nestjs/common';
import type { EverythingSyncConfig } from '../dto/everything-sync-config';
import { SyncStatusResponseDto } from '../dto/sync-status-response.dto';
import { SyncStatusResponseMapper } from '../mappers/sync-status-response.mapper';
import type { ISyncStatusQueryService } from '../ports/sync-status-query.port';
import { SyncRunExpirer } from '../services/sync-run-expirer';
import { EVERYTHING_SYNC_CONFIG, SYNC_STATUS_QUERY_SERVICE } from '../tokens';

/**
 * The state of the sync with Everything for the administrator (HU-138):
 * whether the integration is enabled, the run PEDIDA or EN_CURSO, the last
 * run that ended (when, how many folders, OK or ERROR and why) and the last
 * time the agent of the CLENA called Trackhive. It only reads, all at one
 * same moment (ISyncStatusQueryService): a run the agent abandoned is flagged
 * as expired, and ends when something else starts.
 */
@Injectable()
export class GetSyncStatusUseCase {
  constructor(
    @Inject(SYNC_STATUS_QUERY_SERVICE)
    private readonly query: ISyncStatusQueryService,
    @Inject(EVERYTHING_SYNC_CONFIG)
    private readonly config: EverythingSyncConfig,
    private readonly expirer: SyncRunExpirer,
  ) {}

  async execute(): Promise<SyncStatusResponseDto> {
    const now = new Date();
    const { currentRun, lastRun, agent } = await this.query.read();
    return SyncStatusResponseMapper.toDto({
      enabled: this.config.agentToken !== null,
      currentRun,
      currentRunExpired:
        currentRun !== null && this.expirer.isExpired(currentRun, now),
      lastRun,
      agentLastContactAt: agent?.lastContactAt ?? null,
    });
  }
}
