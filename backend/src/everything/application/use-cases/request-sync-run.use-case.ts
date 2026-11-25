import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { EverythingSyncDisabledError } from '../../domain/errors/everything-sync-disabled.error';
import { SyncRunAlreadyRequestedError } from '../../domain/errors/sync-run-already-requested.error';
import { SyncRunAlreadyRunningError } from '../../domain/errors/sync-run-already-running.error';
import type { ISyncRunRepository } from '../../domain/repositories/sync-run.repository';
import type { EverythingSyncConfig } from '../dto/everything-sync-config';
import type { RequestSyncRunInput } from '../dto/request-sync-run.input';
import { SyncRunResponseDto } from '../dto/sync-run-response.dto';
import { SyncRunResponseMapper } from '../mappers/sync-run-response.mapper';
import { SyncRunExpirer } from '../services/sync-run-expirer';
import { EVERYTHING_SYNC_CONFIG, SYNC_RUN_REPOSITORY } from '../tokens';

/**
 * «Sincronizar ahora» (HU-138): an administrator asks for a run. It stays
 * PEDIDA until the agent of the CLENA takes it, the next time it asks
 * Trackhive (HU-166). There is never a second one:
 * - with a run PEDIDA, 409 SYNC_RUN_ALREADY_REQUESTED;
 * - with a run EN_CURSO, 409 SYNC_RUN_ALREADY_RUNNING, unless the agent
 *   abandoned it: then it ends with an error, marking nothing, and the new
 *   run is asked for;
 * - the partial unique index of sync_runs decides if two administrators, or
 *   an administrator and the agent, get there at the same time.
 * Without EVERYTHING_AGENT_TOKEN the integration is disabled: 503.
 */
@Injectable()
export class RequestSyncRunUseCase {
  private readonly logger = new Logger(RequestSyncRunUseCase.name);

  constructor(
    @Inject(SYNC_RUN_REPOSITORY)
    private readonly runs: ISyncRunRepository,
    @Inject(EVERYTHING_SYNC_CONFIG)
    private readonly config: EverythingSyncConfig,
    private readonly expirer: SyncRunExpirer,
  ) {}

  async execute(input: RequestSyncRunInput): Promise<SyncRunResponseDto> {
    if (this.config.agentToken === null) {
      throw new EverythingSyncDisabledError();
    }
    const now = new Date();
    await this.endAbandonedOrRefuse(now);

    const run = SyncRun.request(randomUUID(), input.userId, now);
    try {
      await this.runs.create(run);
    } catch (error) {
      // Someone got there first, maybe through another instance of the backend
      if (
        error instanceof SyncRunAlreadyRunningError &&
        (await this.runs.findRequested())
      ) {
        throw new SyncRunAlreadyRequestedError();
      }
      throw error;
    }
    this.logger.log(`Sync run ${run.id} requested with «Sincronizar ahora»`);
    return SyncRunResponseMapper.toDto(run);
  }

  /** Only one run PEDIDA or EN_CURSO at a time; an abandoned one ends first. */
  private async endAbandonedOrRefuse(now: Date): Promise<void> {
    if (await this.runs.findRequested()) {
      throw new SyncRunAlreadyRequestedError();
    }
    const running = await this.runs.findRunning();
    if (running) {
      if (!this.expirer.isExpired(running, now)) {
        throw new SyncRunAlreadyRunningError();
      }
      await this.expirer.expire(running, now);
    }
  }
}
