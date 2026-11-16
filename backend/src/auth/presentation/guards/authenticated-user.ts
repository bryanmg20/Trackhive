import type { UserRole } from '../../../users/domain/enums/user-role';

/** User taken from a valid access token, available as `request.user`. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}
