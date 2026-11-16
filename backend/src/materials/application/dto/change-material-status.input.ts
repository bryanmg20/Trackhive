import type { MaterialStatus } from '../../domain/enums/material-status';

/** The new status of a material (HU-08). */
export interface ChangeMaterialStatusInput {
  materialId: string;
  status: MaterialStatus;
  reason?: string;
  // Who makes the change
  userId: string;
}
