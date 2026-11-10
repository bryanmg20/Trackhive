import { Inject, Injectable } from '@nestjs/common';
import { ListMyRequestsQueryDto } from '../dto/list-my-requests-query.dto';
import { DEFAULT_REQUEST_PAGE_LIMIT } from '../dto/list-requests-query.dto';
import {
  MyRequestListItemDto,
  PaginatedMyRequestsResponseDto,
} from '../dto/my-request-list-response.dto';
import type {
  RequestListItem,
  RequestRepository,
} from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';

export type ListMyRequestsInput = ListMyRequestsQueryDto;

function toDto(item: RequestListItem): MyRequestListItemDto {
  return {
    id: item.id,
    trackingCode: item.trackingCode,
    status: item.status,
    deliveryMode: item.deliveryMode,
    // Date-only column: send YYYY-MM-DD, without time or time zone
    desiredDate: item.desiredDate.toISOString().slice(0, 10),
    registeredAt: item.registeredAt.toISOString(),
    materials: item.materials,
  };
}

/**
 * «Mis solicitudes» (HU-11): a public user sees only their own requests.
 * The user comes from the access token, never from the query (D-12).
 */
@Injectable()
export class ListMyRequestsUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: ListMyRequestsInput,
    userId: string,
  ): Promise<PaginatedMyRequestsResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_REQUEST_PAGE_LIMIT;

    const { items, total } = await this.repository.listByRequesterUser(userId, {
      status: input.status,
      // Newest first by default, like the staff list
      sort: input.sort ?? 'registeredAt',
      order: input.order ?? 'desc',
      page,
      limit,
    });

    return { items: items.map(toDto), page, limit, total };
  }
}
