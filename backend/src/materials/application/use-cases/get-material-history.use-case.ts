import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_PAGE_LIMIT } from '../../../common/pagination';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import type { IMaterialLoanRepository } from '../../domain/repositories/material-loan.repository';
import type { IMaterialRepository } from '../../domain/repositories/material.repository';
import type { GetMaterialHistoryInput } from '../dto/get-material-history.input';
import { MaterialHistoryResponseDto } from '../dto/material-history-response.dto';
import { MaterialLoanResponseMapper } from '../mappers/material-loan-response.mapper';
import { MATERIAL_LOAN_REPOSITORY, MATERIAL_REPOSITORY } from '../tokens';

/**
 * «Consultar historial de custodia del material» (HU-72). Returns who last had
 * the material, when it was handed over and returned, and the paginated log.
 */
@Injectable()
export class GetMaterialHistoryUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepo: IMaterialRepository,
    @Inject(MATERIAL_LOAN_REPOSITORY)
    private readonly materialLoanRepo: IMaterialLoanRepository,
  ) {}

  async execute(
    input: GetMaterialHistoryInput,
  ): Promise<MaterialHistoryResponseDto> {
    const material = await this.materialRepo.findById(input.materialId);
    if (!material) {
      throw new MaterialNotFoundError();
    }

    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
    const history = await this.materialLoanRepo.findMaterialHistory({
      materialId: input.materialId,
      page,
      limit,
    });

    return MaterialLoanResponseMapper.toHistoryDto(
      material,
      history,
      page,
      limit,
    );
  }
}
