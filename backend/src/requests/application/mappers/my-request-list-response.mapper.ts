import {
  MyRequestListItemDto,
  PaginatedMyRequestsResponseDto,
} from '../dto/my-request-list-response.dto';
import type { RequestListItem } from '../ports/request-query.port';
import { DateOnlyMapper } from './date-only.mapper';
import { RequestReferenceResponseMapper } from './request-reference-response.mapper';

/** A row of «Mis solicitudes» (HU-11) → its response. */
export class MyRequestListResponseMapper {
  static toDto(item: RequestListItem): MyRequestListItemDto {
    return {
      id: item.id,
      trackingCode: item.trackingCode,
      status: item.status,
      deliveryMode: item.deliveryMode,
      desiredDate: DateOnlyMapper.toDto(item.desiredDate),
      registeredAt: item.registeredAt.toISOString(),
      materials: item.materials,
      references: item.references.map((reference) =>
        RequestReferenceResponseMapper.toListDto(reference, item.status),
      ),
      // The requester sees why their request was rejected (HU-16)
      rejectionReason: item.rejectionReason,
    };
  }

  static toPaginatedDto(
    items: RequestListItem[],
    pagination: { page: number; limit: number; total: number },
  ): PaginatedMyRequestsResponseDto {
    return {
      items: items.map((item) => MyRequestListResponseMapper.toDto(item)),
      ...pagination,
    };
  }
}
