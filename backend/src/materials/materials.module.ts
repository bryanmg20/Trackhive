import { Module } from '@nestjs/common';
import { MATERIAL_REPOSITORY } from './application/tokens';
import { SearchMaterialsUseCase } from './application/use-cases/search-materials.use-case';
import { PrismaMaterialRepository } from './infrastructure/persistence/prisma-material.repository';
import { MaterialController } from './presentation/controllers/material.controller';

@Module({
  controllers: [MaterialController],
  providers: [
    {
      provide: MATERIAL_REPOSITORY,
      useClass: PrismaMaterialRepository,
    },
    SearchMaterialsUseCase,
  ],
})
export class MaterialsModule {}
