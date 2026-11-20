import type { DeliveryMode } from '../../domain/enums/delivery-mode';
import type { MaterialReferenceInput } from './material-reference.input';

/**
 * What both ways of registering a request ask for (HU-09, HU-10): at least
 * one material of the catalog or one written reference (RN-04, HU-09.2).
 */
export interface RequestFieldsInput {
  materialIds?: string[];
  references?: MaterialReferenceInput[];
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
