/** The initial administrator of the .env (ADMIN_EMAIL, ADMIN_PASSWORD, HU-42). */
export interface BootstrapAdminInput {
  email: string;
  // Plain password of the .env; only its hash is stored
  password: string;
  // Production (RUN_SEED=false): the password needs at least 12 characters
  requireStrongPassword: boolean;
}
