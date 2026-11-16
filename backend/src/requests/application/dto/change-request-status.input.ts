import type { ChangeableStatus } from '../../domain/enums/request-status';

/** «Cambiar estado» of the staff (HU-15, HU-16). */
export interface ChangeRequestStatusInput {
  requestId: string;
  status: ChangeableStatus;
  comment?: string;
  // Who makes the change: always the user of the access token
  userId: string;
}
