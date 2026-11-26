import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_PAGE_LIMIT } from '../../../common/pagination';
import type { IMaterialRepository } from '../../domain/repositories/material.repository';
import { PaginatedMaterialsResponseDto } from '../dto/material-response.dto';
import type { SearchMaterialsInput } from '../dto/search-materials.input';
import { MaterialResponseMapper } from '../mappers/material-response.mapper';
import { MATERIAL_REPOSITORY } from '../tokens';

@Injectable()
export class SearchMaterialsUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepo: IMaterialRepository,
  ) {}

  async execute(
    input: SearchMaterialsInput,
  ): Promise<PaginatedMaterialsResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_PAGE_LIMIT;

    const { items, total } = await this.materialRepo.search({
      q: input.q,
      type: input.type,
      collection: input.collection,
      status: input.status,
      sort: input.sort ?? 'title',
      order: input.order ?? 'asc',
      page,
      limit,
    });

    return MaterialResponseMapper.toPaginatedDto(
      items,
      { page, limit, total },
      input.viewerRole,
    );
  }
}
