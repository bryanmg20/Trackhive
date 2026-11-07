export const USER_ROLES = ['ADMIN', 'PERSONAL', 'PUBLICO'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
