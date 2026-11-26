import type { UserRole } from '../../../users/domain/enums/user-role';

/**
 * Only staff and administrators see the Everything folder name and review
 * status of a material (HU-140); public users only see digital availability.
 */
export function canViewDigitalCopyDetails(role: UserRole): boolean {
  return role !== 'PUBLICO';
}
