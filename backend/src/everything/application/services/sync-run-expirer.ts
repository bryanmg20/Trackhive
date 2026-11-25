import { Inject, Injectable, Logger } from '@nestjs/common';
import { SyncRun } from '../../domain/entities/sync-run.entity';
import { SyncRunNotRunningError } from '../../domain/errors/sync-run-not-running.error';
import type { ISyncRunRepository } from '../../domain/repositories/sync-run.repository';
import type { EverythingSyncConfig } from '../dto/everything-sync-config';
import { EVERYTHING_SYNC_CONFIG, SYNC_RUN_REPOSITORY } from '../tokens';

/**
 * Runs EN_CURSO that spent EVERYTHING_RUN_TIMEOUT_MINUTES without pages: the
 * agent stopped or lost the connection (HU-137). They end with an error and
 * mark nothing as not found. It happens when the agent starts another run or
 * writes to the expired one, and when an administrator asks for «Sincronizar
 * ahora» (HU-138), so a run the agent abandoned never blocks the next one.
 */
@Injectable()
export class SyncRunExpirer {
  private readonly logger = new Logger(SyncRunExpirer.name);

  constructor(
    @Inject(SYNC_RUN_REPOSITORY)
    private readonly runs: ISyncRunRepository,
    @Inject(EVERYTHING_SYNC_CONFIG)
    private readonly config: EverythingSyncConfig,
  ) {}

  get timeoutMinutes(): number {
    return this.config.runTimeoutMinutes;
  }

  isExpired(run: SyncRun, now: Date): boolean {
    return run.isExpired(this.timeoutMinutes, now);
  }

  /**
   * Ends a run that spent the timeout without pages. If another instance
   * ended it first, or a page arrived meanwhile, there is nothing to do.
   */
  async expire(run: SyncRun, now: Date): Promise<void> {
    try {
      await this.runs.finish(
        run.expire(this.timeoutMinutes, now),
        SyncRun.inactiveBefore(this.timeoutMinutes, now),
      );
      this.logger.warn(
        `Sync run ${run.id} expired after ${this.timeoutMinutes} minutes without pages; nothing was marked as not found`,
      );
    } catch (error) {
      if (!(error instanceof SyncRunNotRunningError)) {
        throw error;
      }
    }
  }
}
