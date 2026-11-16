import { Inject, Injectable } from '@nestjs/common';
import { HealthResponseDto } from '../dto/health-response.dto';
import { HealthResponseMapper } from '../mappers/health-response.mapper';
import type { IDatabaseHealthChecker } from '../ports/database-health-checker.port';
import { DATABASE_HEALTH_CHECKER } from '../tokens';

@Injectable()
export class GetHealthUseCase {
  constructor(
    @Inject(DATABASE_HEALTH_CHECKER)
    private readonly databaseHealthChecker: IDatabaseHealthChecker,
  ) {}

  async execute(): Promise<HealthResponseDto> {
    const databaseAvailable = await this.databaseHealthChecker.isAvailable();

    return HealthResponseMapper.toDto(databaseAvailable);
  }
}
