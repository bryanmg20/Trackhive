import { Module } from '@nestjs/common';
import { DATABASE_HEALTH_CHECKER } from './application/tokens';
import { GetHealthUseCase } from './application/use-cases/get-health.use-case';
import { PrismaDatabaseHealthChecker } from './infrastructure/database/prisma-database-health-checker';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: DATABASE_HEALTH_CHECKER,
      useClass: PrismaDatabaseHealthChecker,
    },
    GetHealthUseCase,
  ],
})
export class HealthModule {}
