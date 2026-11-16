import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_REQUEST_PAGE_LIMIT } from '../../../common/pagination';
import type { ListRequestsInput } from '../dto/list-requests.input';
import { PaginatedRequestsResponseDto } from '../dto/request-list-response.dto';
import { RequestListResponseMapper } from '../mappers/request-list-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

@Injectable()
export class ListRequestsUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: ListRequestsInput,
  ): Promise<PaginatedRequestsResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_REQUEST_PAGE_LIMIT;

    const { items, total } = await this.queries.list({
      status: input.status,
      desiredFrom: input.desiredFrom,
      desiredTo: input.desiredTo,
      requester: input.requester,
      material: input.material,
      // Newest first by default, so the staff sees what just arrived
      sort: input.sort ?? 'registeredAt',
      order: input.order ?? 'desc',
      page,
      limit,
    });

    return RequestListResponseMapper.toPaginatedDto(items, {
      page,
      limit,
      total,
    });
  }
}
