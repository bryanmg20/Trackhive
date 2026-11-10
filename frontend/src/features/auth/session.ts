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
 * Reads the refresh token from the session storage.
 * Storage can be blocked (private mode), so it is read defensively.
 */
export function readRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function readClaims(accessToken: string): Record<string, unknown> | null {
  const payload = accessToken.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const claims: unknown = JSON.parse(atob(padded));

    return typeof claims === 'object' && claims !== null
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    // Malformed token; treat it as having no claims.
    return null;
  }
}

/**
 * Reads the role claim from the access token payload.
 * The signature is not checked here: the backend verifies it on every request.
 *
 * An expired access token still carries a valid role. The session can renew it
 * with the refresh token, so the role is kept and the API layer refreshes the
 * session on the first 401 (see `authenticatedFetch`).
 */
export function readRoleFromToken(accessToken: string): UserRole | null {
  const claims = readClaims(accessToken);

  if (!claims || !isUserRole(claims.role)) {
    return null;
  }

  return claims.role;
}

/** True when the access token is expired or has no readable expiry. */
export function isAccessTokenExpired(accessToken: string | null): boolean {
  if (!accessToken) {
    return true;
  }

  const claims = readClaims(accessToken);
  if (!claims || typeof claims.exp !== 'number') {
    return true;
  }

  return claims.exp * 1000 <= Date.now();
}

/** Role of the current session, even if the access token needs renewal. */
export function readSessionRole(): UserRole | null {
  const accessToken = readAccessToken();
  return accessToken ? readRoleFromToken(accessToken) : null;
}

export function saveSession(session: LoginSession): void {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } catch {
    // Storage can be blocked (private mode); the login still succeeds.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Storage can be blocked (private mode); there is nothing to clear.
  }
}
