import { Inject, Injectable } from '@nestjs/common';
import { MATERIAL_REPOSITORY } from '../../../materials/application/tokens';
import type { IMaterialRepository } from '../../../materials/domain/repositories/material.repository';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { ResolveReferenceInput } from '../dto/resolve-reference.input';
import { ResolveReferenceResponseDto } from '../dto/request-reference-response.dto';
import { RequestReferenceResponseMapper } from '../mappers/request-reference-response.mapper';
import { REQUEST_REPOSITORY } from '../tokens';

/**
 * «Asociar material» (HU-09.2): the staff gives a pending written reference
 * its catalog material, normally the one the sync brought after digitizing
 * it. The entity decides whether it may (the reference is pending and the
 * request RECIBIDA or EN_BUSQUEDA); the repository saves the reference, the
 * material in the request and the history row together.
 */
@Injectable()
export class ResolveReferenceUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: IRequestRepository,
    @Inject(MATERIAL_REPOSITORY)
    private readonly materials: IMaterialRepository,
  ) {}

  async execute(
    input: ResolveReferenceInput,
  ): Promise<ResolveReferenceResponseDto> {
    const request = await this.repository.findById(input.requestId);
    if (!request) {
      throw new RequestNotFoundError();
    }
    const material = await this.materials.findById(input.materialId);
    if (!material) {
      throw new RequestMaterialNotFoundError();
    }

    // Throws MaterialReferenceNotFoundError (404), or
    // MaterialReferenceAlreadyResolvedError / NotResolvableError (409)
    const resolution = request.resolveReference(
      input.referenceId,
      material,
      input.userId,
    );
    const saved = await this.repository.saveReferenceResolution(resolution);

    return RequestReferenceResponseMapper.toResolutionDto(
      request.id,
      saved,
      material,
    );
  }
}
