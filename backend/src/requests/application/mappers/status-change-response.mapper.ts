import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import { StatusChangeDto } from '../dto/change-request-status-response.dto';
import { PersonNameMapper } from './person-name.mapper';

/** A saved row of status_history (HU-15) → the change shown to the staff. */
export class StatusChangeResponseMapper {
  static toDto(saved: SavedStatusChange): StatusChangeDto {
    return {
      previousStatus: saved.previousStatus,
      newStatus: saved.newStatus,
      changedAt: saved.changedAt.toISOString(),
      changedBy: {
        id: saved.changedBy.id,
        name: PersonNameMapper.fullName(saved.changedBy),
      },
      comment: saved.comment,
    };
  }
}
