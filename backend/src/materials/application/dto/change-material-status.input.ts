import type { UserRole } from '../../../users/domain/enums/user-role';
import type { MaterialStatus } from '../../domain/enums/material-status';

/** The new status of a material (HU-08, HU-140). */
export interface ChangeMaterialStatusInput {
  materialId: string;
  status: MaterialStatus;
  reason?: string;
  // Who makes the change
  userId: string;
  viewerRole: UserRole;
}
