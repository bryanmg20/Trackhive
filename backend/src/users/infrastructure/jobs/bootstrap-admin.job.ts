import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BootstrapAdminUseCase } from '../../application/use-cases/bootstrap-admin.use-case';

/**
 * Creates the initial administrator from ADMIN_EMAIL and ADMIN_PASSWORD when
 * the server starts (HU-42), with RUN_SEED=true or false. main.ts runs it
 * before listening, so the tests that build the AppModule never create one.
 * Like a controller, it only reads the configuration and triggers the use
 * case. A wrong .env stops the server: it must not run without an
 * administrator.
 */
@Injectable()
export class BootstrapAdminJob {
  private readonly logger = new Logger(BootstrapAdminJob.name);

  constructor(
    private readonly config: ConfigService,
    private readonly bootstrapAdmin: BootstrapAdminUseCase,
  ) {}

  async run(): Promise<void> {
    const email = this.config.get<string>('ADMIN_EMAIL')?.trim();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env');
    }

    try {
      const created = await this.bootstrapAdmin.execute({
        email,
        password,
        // Only the development .env loads the demo data
        requireStrongPassword: this.config.get<string>('RUN_SEED') !== 'true',
      });
      if (created) {
        this.logger.log('Initial administrator created from ADMIN_EMAIL');
      }
    } catch (error) {
      this.logger.error(
        `Could not create the initial administrator: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
