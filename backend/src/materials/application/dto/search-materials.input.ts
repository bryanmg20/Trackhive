import type { MaterialStatus } from '../../domain/enums/material-status';
import type { MaterialType } from '../../domain/enums/material-type';
import type {
  MaterialSortField,
  SortOrder,
} from '../../domain/repositories/material.repository';

/** The filters of the material search (HU-07). */
export interface SearchMaterialsInput {
  q?: string;
  type?: MaterialType;
  collection?: string;
  status?: MaterialStatus;
  sort?: MaterialSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}
