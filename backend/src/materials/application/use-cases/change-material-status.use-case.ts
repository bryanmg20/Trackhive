import { Inject, Injectable } from '@nestjs/common';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import type { MaterialStatus } from '../../domain/material-status';
import type { IMaterialRepository } from '../../domain/repositories/material.repository';
import { MaterialResponseDto } from '../dto/material-response.dto';
import { MaterialResponseMapper } from '../mappers/material-response.mapper';
import { MATERIAL_REPOSITORY } from '../tokens';

export interface ChangeMaterialStatusInput {
  materialId: string;
  status: MaterialStatus;
  reason?: string;
  // Who makes the change
  userId: string;
}

// Only staff can call this use case, so the location is always included
const INCLUDE_LOCATION = true;

@Injectable()
export class ChangeMaterialStatusUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepo: IMaterialRepository,
  ) {}

  async execute(
    input: ChangeMaterialStatusInput,
  ): Promise<MaterialResponseDto> {
    const material = await this.materialRepo.findById(input.materialId);
    if (!material) {
      throw new MaterialNotFoundError();
    }

    const changed = material.changeStatus(
      input.status,
      input.userId,
      input.reason ?? null,
    );
    await this.materialRepo.saveStatusChange(changed);

    return MaterialResponseMapper.toDto(changed, INCLUDE_LOCATION);
  }
}
