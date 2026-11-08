import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../../users/domain/user-role';

export const ROLES_KEY = 'roles';

/** Roles allowed to call an endpoint; without it, any signed-in user can (D-12). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
