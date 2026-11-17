import {
  canSeeHistoryEntry,
  revealsResponsible,
} from '../../domain/policies/request-history-access';
import type { HistoryViewer } from '../../domain/policies/request-history-access';
import { RequestHistoryResponseDto } from '../dto/request-history-response.dto';
import type { RequestHistory } from '../ports/request-query.port';
import { PersonNameMapper } from './person-name.mapper';

// What the requester reads instead of the name of the staff member
const STAFF_RESPONSIBLE = 'Personal del CLENA';

/** The timeline of a request (HU-17) → its response, as `viewer` may see it. */
export class RequestHistoryResponseMapper {
  static toDto(
    history: RequestHistory,
    viewer: HistoryViewer,
  ): RequestHistoryResponseDto {
    return {
      requestId: history.requestId,
      trackingCode: history.trackingCode,
      entries: history.entries
        .filter((entry) => canSeeHistoryEntry(viewer, entry))
        .map((entry) => ({
          id: entry.id,
          previousStatus: entry.previousStatus,
          newStatus: entry.newStatus,
          changedAt: entry.changedAt.toISOString(),
          changedBy: revealsResponsible(viewer, entry.changedBy.id)
            ? PersonNameMapper.fullName(entry.changedBy)
            : STAFF_RESPONSIBLE,
          comment: entry.comment,
        })),
    };
  }
}
