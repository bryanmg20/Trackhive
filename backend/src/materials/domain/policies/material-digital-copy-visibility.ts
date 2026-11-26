import type { UserRole } from '../../../users/domain/enums/user-role';

/**
 * Only PERSONAL and ADMIN see the Everything folder name and review status of a
 * material (HU-140); PUBLICO and any future role default to seeing availability only.
 */
export function canViewDigitalCopyDetails(role: UserRole): boolean {
  return role === 'PERSONAL' || role === 'ADMIN';
}
