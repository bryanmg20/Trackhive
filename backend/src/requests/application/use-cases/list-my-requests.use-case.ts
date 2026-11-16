import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_REQUEST_PAGE_LIMIT } from '../../../common/pagination';
import type { ListMyRequestsInput } from '../dto/list-my-requests.input';
import { PaginatedMyRequestsResponseDto } from '../dto/my-request-list-response.dto';
import { MyRequestListResponseMapper } from '../mappers/my-request-list-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

/**
 * «Mis solicitudes» (HU-11): a public user sees only their own requests.
 * The user comes from the access token, never from the query (D-12).
 */
@Injectable()
export class ListMyRequestsUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: ListMyRequestsInput,
  ): Promise<PaginatedMyRequestsResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_REQUEST_PAGE_LIMIT;

    const { items, total } = await this.queries.listByRequesterUser(
      input.userId,
      {
        status: input.status,
        // Newest first by default, like the staff list
        sort: input.sort ?? 'registeredAt',
        order: input.order ?? 'desc',
        page,
        limit,
      },
    );

    return MyRequestListResponseMapper.toPaginatedDto(items, {
      page,
      limit,
      total,
    });
  }
}
