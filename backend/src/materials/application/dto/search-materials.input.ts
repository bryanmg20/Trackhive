import type { UserRole } from '../../../users/domain/enums/user-role';
import type { MaterialStatus } from '../../domain/enums/material-status';
import type { MaterialType } from '../../domain/enums/material-type';
import type {
  MaterialSortField,
  SortOrder,
} from '../../domain/repositories/material.repository';

/** The filters of the material search (HU-07) and who is searching. */
export interface SearchMaterialsInput {
  q?: string;
  type?: MaterialType;
  collection?: string;
  status?: MaterialStatus;
  sort?: MaterialSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
  // Decides whether the physical location is included
  viewerRole: UserRole;
}
