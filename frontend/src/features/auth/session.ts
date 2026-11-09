import type { LoginSession } from './api/login-user';

export const USER_ROLES = ['ADMIN', 'PERSONAL', 'PUBLICO'] as const;

export type UserRole = (typeof USER_ROLES)[number];

const ACCESS_TOKEN_KEY = 'trackhive.accessToken';
const REFRESH_TOKEN_KEY = 'trackhive.refreshToken';

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Reads the access token from the session storage.
 * Storage can be blocked (private mode), so it is read defensively.
 */
export function readAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
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

    if (
      typeof claims !== 'object' ||
      claims === null ||
      !('role' in claims) ||
      typeof claims.role !== 'string' ||
      !isUserRole(claims.role) ||
      !('exp' in claims) ||
      typeof claims.exp !== 'number' ||
      claims.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return claims.role;
  } catch {
    // Malformed token; treat it as having no role.
  }

  return null;
}

export function saveSession(session: LoginSession): void {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } catch {
    // Storage can be blocked (private mode); the login still succeeds.
  }
}
