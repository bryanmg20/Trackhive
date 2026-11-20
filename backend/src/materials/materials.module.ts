import { Module } from '@nestjs/common';
import {
  MATERIAL_LOAN_REPOSITORY,
  MATERIAL_REPOSITORY,
} from './application/tokens';
import { ChangeMaterialStatusUseCase } from './application/use-cases/change-material-status.use-case';
import { GetMaterialHistoryUseCase } from './application/use-cases/get-material-history.use-case';
import { ReturnMaterialUseCase } from './application/use-cases/return-material.use-case';
import { SearchMaterialsUseCase } from './application/use-cases/search-materials.use-case';
import { PrismaMaterialLoanRepository } from './infrastructure/persistence/prisma-material-loan.repository';
import { PrismaMaterialRepository } from './infrastructure/persistence/prisma-material.repository';
import { MaterialController } from './presentation/controllers/material.controller';

@Module({
  controllers: [MaterialController],
  providers: [
    {
      provide: MATERIAL_REPOSITORY,
      useClass: PrismaMaterialRepository,
    },
    {
      provide: MATERIAL_LOAN_REPOSITORY,
      useClass: PrismaMaterialLoanRepository,
    },
    SearchMaterialsUseCase,
    ChangeMaterialStatusUseCase,
    ReturnMaterialUseCase,
    GetMaterialHistoryUseCase,
  ],
  exports: [MATERIAL_LOAN_REPOSITORY],
})
export class MaterialsModule {}
