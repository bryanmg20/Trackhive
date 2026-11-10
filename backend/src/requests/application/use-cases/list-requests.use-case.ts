import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_REQUEST_PAGE_LIMIT,
  ListRequestsQueryDto,
} from '../dto/list-requests-query.dto';
import {
  PaginatedRequestsResponseDto,
  RequestListItemDto,
} from '../dto/request-list-response.dto';
import type {
  RequestListItem,
  RequestRepository,
} from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';

export type ListRequestsInput = ListRequestsQueryDto;

function fullName(requester: RequestListItem['requester']): string {
  return [
    requester.firstName,
    requester.middleName,
    requester.lastName,
    requester.secondLastName,
  ]
    .filter(Boolean)
    .join(' ');
}

function toDto(item: RequestListItem): RequestListItemDto {
  return {
    id: item.id,
    trackingCode: item.trackingCode,
    status: item.status,
    deliveryMode: item.deliveryMode,
    // Date-only column: send YYYY-MM-DD, without time or time zone
    desiredDate: item.desiredDate.toISOString().slice(0, 10),
    registeredAt: item.registeredAt.toISOString(),
    requesterName: fullName(item.requester),
    requesterEmail: item.requester.email,
    materials: item.materials,
  };
}

@Injectable()
export class ListRequestsUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: ListRequestsInput,
  ): Promise<PaginatedRequestsResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_REQUEST_PAGE_LIMIT;

    const { items, total } = await this.repository.list({
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

    return { items: items.map(toDto), page, limit, total };
  }
}
