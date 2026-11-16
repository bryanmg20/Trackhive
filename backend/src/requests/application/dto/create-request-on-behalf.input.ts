import type { RequestFieldsInput } from './create-request.input';
import type { RequesterInput } from './requester.input';

/** A staff member registers a request on behalf of a visitor (HU-10). */
export interface CreateRequestOnBehalfInput extends RequestFieldsInput {
  requester: RequesterInput;
  // The staff member of the access token
  createdById: string;
}
