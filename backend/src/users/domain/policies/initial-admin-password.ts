/**
 * Minimum length of ADMIN_PASSWORD in production (RUN_SEED=false, HU-42).
 * In development the demo data uses short passwords, so it is not required.
 */
export const MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH = 12;

/** Whether the initial administrator password is long enough for production. */
export function isStrongAdminPassword(password: string): boolean {
  return password.length >= MIN_PRODUCTION_ADMIN_PASSWORD_LENGTH;
}
