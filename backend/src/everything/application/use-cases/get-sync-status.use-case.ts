import { Inject, Injectable } from '@nestjs/common';
import type { ISyncAgentRepository } from '../../domain/repositories/sync-agent.repository';
import type { ISyncRunRepository } from '../../domain/repositories/sync-run.repository';
import type { EverythingSyncConfig } from '../dto/everything-sync-config';
import { SyncStatusResponseDto } from '../dto/sync-status-response.dto';
import { SyncStatusResponseMapper } from '../mappers/sync-status-response.mapper';
import { SyncRunExpirer } from '../services/sync-run-expirer';
import {
  EVERYTHING_SYNC_CONFIG,
  SYNC_AGENT_REPOSITORY,
  SYNC_RUN_REPOSITORY,
} from '../tokens';

/**
 * The state of the sync with Everything for the administrator (HU-138):
 * whether the integration is enabled, the run PEDIDA or EN_CURSO, the last
 * run that ended (when, how many folders, OK or ERROR and why) and the last
 * time the agent of the CLENA called Trackhive. It only reads: a run the
 * agent abandoned is flagged as expired, and ends when something else starts.
 */
@Injectable()
export class GetSyncStatusUseCase {
  constructor(
    @Inject(SYNC_RUN_REPOSITORY)
    private readonly runs: ISyncRunRepository,
    @Inject(SYNC_AGENT_REPOSITORY)
    private readonly agent: ISyncAgentRepository,
    @Inject(EVERYTHING_SYNC_CONFIG)
    private readonly config: EverythingSyncConfig,
    private readonly expirer: SyncRunExpirer,
  ) {}

  async execute(): Promise<SyncStatusResponseDto> {
    const now = new Date();
    const [requested, running, lastRun, agentLastContactAt] = await Promise.all(
      [
        this.runs.findRequested(),
        this.runs.findRunning(),
        this.runs.findLastFinished(),
        this.agent.findLastContact(),
      ],
    );
    // Never both: the partial unique index of sync_runs keeps one at a time
    const currentRun = requested ?? running;
    return SyncStatusResponseMapper.toDto({
      enabled: this.config.agentToken !== null,
      currentRun,
      currentRunExpired:
        currentRun !== null && this.expirer.isExpired(currentRun, now),
      lastRun,
      agentLastContactAt,
    });
  }
}
