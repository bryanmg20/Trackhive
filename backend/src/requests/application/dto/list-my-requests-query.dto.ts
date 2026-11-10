import { PickType } from '@nestjs/swagger';
import { ListRequestsQueryDto } from './list-requests-query.dto';

/**
 * Query of «Mis solicitudes» (HU-11). It keeps the validation, defaults and
 * Swagger docs of the staff list (HU-12), but only the status filter, the
 * order and the page: the filters by requester, material or dates are not
 * accepted (the global ValidationPipe answers 400 to unknown parameters).
 */
export class ListMyRequestsQueryDto extends PickType(ListRequestsQueryDto, [
  'status',
  'sort',
  'order',
  'page',
  'limit',
] as const) {}
