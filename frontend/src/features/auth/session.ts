import type { LoginSession } from './api/login-user';

export const USER_ROLES = ['ADMIN', 'PERSONAL', 'PUBLICO'] as const;

export type UserRole = (typeof USER_ROLES)[number];

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Reads the role claim from the access token payload.
 * The signature is not checked here: the backend verifies it on every request.
 */
export function readRoleFromToken(accessToken: string): UserRole | null {
  const payload = accessToken.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const claims: unknown = JSON.parse(atob(padded));

    if (typeof claims === 'object' && claims !== null && 'role' in claims) {
      return isUserRole(claims.role) ? claims.role : null;
    }
  } catch {
    // Malformed token; treat it as having no role.
  }

  return null;
}

export function saveSession(session: LoginSession): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
}
