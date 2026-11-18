import type { StaffAccountChanges } from '../../domain/entities/user.entity';

/**
 * The changes to a staff account (HU-05). A field left undefined keeps its
 * value; `active: false` deactivates the account and `true` reactivates it.
 */
export interface UpdateStaffUserInput extends StaffAccountChanges {
  userId: string;
  // The administrator who makes the change
  changedBy: string;
}
