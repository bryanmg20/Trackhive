export const USER_ROLES = ['ADMIN', 'PERSONAL', 'PUBLICO'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/** Roles of the CLENA staff: the accounts an administrator manages (HU-05). */
export const STAFF_ROLES = ['PERSONAL', 'ADMIN'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}
