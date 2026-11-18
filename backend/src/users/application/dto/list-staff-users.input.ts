import type { StaffRole } from '../../domain/enums/user-role';
import type {
  SortOrder,
  UserSortField,
} from '../../domain/repositories/user.repository';

/** The filters, order and page of the staff accounts listing (HU-05). */
export interface ListStaffUsersInput {
  // Text to find in the names or the email
  q?: string;
  role?: StaffRole;
  active?: boolean;
  sort?: UserSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}
