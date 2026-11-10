import { ApiProperty, OmitType } from '@nestjs/swagger';
import {
  PaginatedRequestsResponseDto,
  RequestListItemDto,
} from './request-list-response.dto';

/**
 * A request in «Mis solicitudes» (HU-11). Same fields as the staff list,
 * without the requester's name and email: they are the user's own data.
 */
export class MyRequestListItemDto extends OmitType(RequestListItemDto, [
  'requesterName',
  'requesterEmail',
] as const) {}

export class PaginatedMyRequestsResponseDto extends OmitType(
  PaginatedRequestsResponseDto,
  ['items'] as const,
) {
  @ApiProperty({ type: [MyRequestListItemDto] })
  items: MyRequestListItemDto[];
}
