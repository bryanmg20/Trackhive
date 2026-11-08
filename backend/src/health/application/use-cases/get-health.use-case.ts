import { Inject, Injectable } from '@nestjs/common';
import { HealthResponseDto } from '../dto/health-response.dto';
import type { DatabaseHealthChecker } from '../ports/database-health-checker.port';
import { DATABASE_HEALTH_CHECKER } from '../tokens';

@Injectable()
export class GetHealthUseCase {
  constructor(
    @Inject(DATABASE_HEALTH_CHECKER)
    private readonly databaseHealthChecker: DatabaseHealthChecker,
  ) {}

  async execute(): Promise<HealthResponseDto> {
    const databaseAvailable = await this.databaseHealthChecker.isAvailable();

    return {
      status: databaseAvailable ? 'ok' : 'degraded',
      database: databaseAvailable ? 'up' : 'down',
    };
  }
}
