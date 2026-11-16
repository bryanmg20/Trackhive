import type { Request } from '../../domain/entities/request.entity';
import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import { ChangeRequestStatusResponseDto } from '../dto/change-request-status-response.dto';
import { StatusChangeResponseMapper } from './status-change-response.mapper';

/** The request after «Cambiar estado» (HU-15) → its response. */
export class ChangeRequestStatusResponseMapper {
  static toDto(
    request: Request,
    saved: SavedStatusChange,
  ): ChangeRequestStatusResponseDto {
    return {
      id: request.id,
      status: request.status,
      allowedTransitions: request.allowedTransitions,
      rejectionReason: request.rejectionReason,
      statusChange: StatusChangeResponseMapper.toDto(saved),
    };
  }
}
