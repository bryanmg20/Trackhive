import { apiUrl } from '../../auth/api/api-base-url';
import { authenticatedFetch } from '../../auth/api/authenticated-fetch';
import { readErrorMessage, RequestsApiError } from './list-requests';
import type {
  RequestListItem,
  RequestSortField,
  RequestStatus,
  SortOrder,
} from './list-requests';

/** Like the staff list item, without the requester: they are the user's own data. */
export type MyRequestItem = Omit<
  RequestListItem,
  'requesterName' | 'requesterEmail'
>;

export interface MyRequestPage {
  items: MyRequestItem[];
  page: number;
  limit: number;
  total: number;
}

export interface ListMyRequestsParams {
  status?: RequestStatus;
  sort: RequestSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

/** Calls the HU-11 endpoint `GET /api/v1/requests/mine`. */
export async function listMyRequests(
  params: ListMyRequestsParams,
): Promise<MyRequestPage> {
  const query = new URLSearchParams({
    sort: params.sort,
    order: params.order,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) query.set('status', params.status);

  const response = await authenticatedFetch(
    apiUrl(`/api/v1/requests/mine?${query}`),
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) {
    throw new RequestsApiError(
      await readErrorMessage(response),
      response.status,
    );
  }
  return (await response.json()) as MyRequestPage;
}
