import { Inject, Injectable } from '@nestjs/common';
import type { UserRole } from '../../../users/domain/user-role';
import type { MaterialStatus } from '../../domain/material-status';
import type { MaterialType } from '../../domain/material-type';
import type {
  IMaterialRepository,
  MaterialSortField,
  SortOrder,
} from '../../domain/repositories/material.repository';
import { PaginatedMaterialsResponseDto } from '../dto/material-response.dto';
import { DEFAULT_PAGE_LIMIT } from '../dto/search-materials-query.dto';
import { MaterialResponseMapper } from '../mappers/material-response.mapper';
import { MATERIAL_REPOSITORY } from '../tokens';

// Business rule (HU-07): only staff can see where a material is stored
const ROLES_THAT_SEE_LOCATION: readonly UserRole[] = ['PERSONAL', 'ADMIN'];

export interface SearchMaterialsInput {
  q?: string;
  type?: MaterialType;
  collection?: string;
  status?: MaterialStatus;
  sort?: MaterialSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

@Injectable()
export class SearchMaterialsUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepo: IMaterialRepository,
  ) {}

  async execute(
    input: SearchMaterialsInput,
    viewerRole: UserRole,
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

    const includeLocation = ROLES_THAT_SEE_LOCATION.includes(viewerRole);
    return {
      items: items.map((material) =>
        MaterialResponseMapper.toDto(material, includeLocation),
      ),
      page,
      limit,
      total,
    };
  }
}
