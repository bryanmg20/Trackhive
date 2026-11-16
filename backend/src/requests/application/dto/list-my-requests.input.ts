import type { ListRequestsInput } from './list-requests.input';

/** «Mis solicitudes» (HU-11): the status filter, the order and the page. */
export interface ListMyRequestsInput extends Pick<
  ListRequestsInput,
  'status' | 'sort' | 'order' | 'page' | 'limit'
> {
  // The user of the access token, never a value of the query (D-12)
  userId: string;
}
