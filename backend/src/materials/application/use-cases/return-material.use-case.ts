import { Inject, Injectable } from '@nestjs/common';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import { MaterialNotInUseError } from '../../domain/errors/material-not-in-use.error';
import type { IMaterialLoanRepository } from '../../domain/repositories/material-loan.repository';
import type { IMaterialRepository } from '../../domain/repositories/material.repository';
import { MaterialLoanResponseDto } from '../dto/material-loan-response.dto';
import type { ReturnMaterialInput } from '../dto/return-material.input';
import { MaterialLoanResponseMapper } from '../mappers/material-loan-response.mapper';
import { MATERIAL_LOAN_REPOSITORY, MATERIAL_REPOSITORY } from '../tokens';

/**
 * «Registrar devolución de material» (HU-72). Closes the open custody loan of
 * an in-use material and restores its status to DISPONIBLE.
 */
@Injectable()
export class ReturnMaterialUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepo: IMaterialRepository,
    @Inject(MATERIAL_LOAN_REPOSITORY)
    private readonly materialLoanRepo: IMaterialLoanRepository,
  ) {}

  async execute(input: ReturnMaterialInput): Promise<MaterialLoanResponseDto> {
    const material = await this.materialRepo.findById(input.materialId);
    if (!material) {
      throw new MaterialNotFoundError();
    }
    if (material.status !== 'EN_USO') {
      throw new MaterialNotInUseError();
    }

    const returned = await this.materialLoanRepo.returnActiveLoan({
      materialId: input.materialId,
      returnedById: input.userId,
      returnNotes: input.notes ?? null,
    });

    return MaterialLoanResponseMapper.toDto(returned);
  }
}
