import type { RequestStatus } from '../../domain/enums/request-status';
import type { RequestSortField, SortOrder } from '../ports/request-query.port';

/** The filters, order and page of the staff listing (HU-12). */
export interface ListRequestsInput {
  status?: RequestStatus;
  // Desired date range, both ends included, as YYYY-MM-DD
  desiredFrom?: string;
  desiredTo?: string;
  requester?: string;
  material?: string;
  // Only the requests with a pending written reference (HU-09.2)
  pendingReferences?: boolean;
  sort?: RequestSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}
