import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PurgeExpiredTokensUseCase } from '../../application/use-cases/purge-expired-tokens.use-case';

export const PURGE_EXPIRED_TOKENS_JOB = 'purge-expired-refresh-tokens';

/**
 * Runs the purge every day at 3:00 (Bogotá time) and once when the app
 * starts. The startup run covers servers that are off at night, which
 * would never reach 3:00. Like a controller, it only triggers the use case.
 */
@Injectable()
export class PurgeExpiredTokensJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(PurgeExpiredTokensJob.name);

  constructor(private readonly purgeExpiredTokens: PurgeExpiredTokensUseCase) {}

  onApplicationBootstrap(): Promise<void> {
    return this.run();
  }

  @Cron('0 3 * * *', {
    name: PURGE_EXPIRED_TOKENS_JOB,
    timeZone: 'America/Bogota',
  })
  async run(): Promise<void> {
    try {
      const deleted = await this.purgeExpiredTokens.execute();
      this.logger.log(`Expired refresh tokens deleted: ${deleted}`);
    } catch (error) {
      // A failed purge must not stop the app; the next run tries again
      this.logger.error(
        'Could not delete expired refresh tokens',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
