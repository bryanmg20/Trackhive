import type { DeliveryMode } from '../../domain/enums/delivery-mode';

/** What both ways of registering a request ask for (HU-09, HU-10). */
export interface RequestFieldsInput {
  materialIds: string[];
  reason: string;
  // YYYY-MM-DD
  desiredDate: string;
  deliveryMode: DeliveryMode;
  requirementDescription?: string;
}

/** A public user radicates their own request (HU-09). */
export interface CreateRequestInput extends RequestFieldsInput {
  // The user of the access token, who is also the requester
  userId: string;
}
