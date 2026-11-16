import {
  PaginatedRequestsResponseDto,
  RequestListItemDto,
} from '../dto/request-list-response.dto';
import type { RequestListItem } from '../ports/request-query.port';
import { DateOnlyMapper } from './date-only.mapper';
import { PersonNameMapper } from './person-name.mapper';

/** A row of the staff listing (HU-12) → its response. */
export class RequestListResponseMapper {
  static toDto(item: RequestListItem): RequestListItemDto {
    return {
      id: item.id,
      trackingCode: item.trackingCode,
      status: item.status,
      deliveryMode: item.deliveryMode,
      desiredDate: DateOnlyMapper.toDto(item.desiredDate),
      registeredAt: item.registeredAt.toISOString(),
      requesterName: PersonNameMapper.fullName(item.requester),
      requesterEmail: item.requester.email,
      materials: item.materials,
    };
  }

  static toPaginatedDto(
    items: RequestListItem[],
    pagination: { page: number; limit: number; total: number },
  ): PaginatedRequestsResponseDto {
    return {
      items: items.map((item) => RequestListResponseMapper.toDto(item)),
      ...pagination,
    };
  }
}
