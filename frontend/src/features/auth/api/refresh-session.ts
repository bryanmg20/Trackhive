import {
  clearSession,
  readRefreshToken,
  saveSession,
} from '../session';
import type { LoginSession } from './login-user';
import { apiUrl } from './api-base-url';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

function isRefreshResponse(value: unknown): value is RefreshResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accessToken' in value &&
    typeof value.accessToken === 'string' &&
    'refreshToken' in value &&
    typeof value.refreshToken === 'string'
  );
}

// Rotation (D-11) makes a refresh token single-use: two concurrent renewals
// with the same token would revoke the whole session. Every caller waits for
// the same request instead.
let inFlight: Promise<LoginSession | null> | null = null;

/**
 * Renews the session with the stored refresh token.
 * Returns `null` when there is nothing to renew or the backend rejects it.
 */
export function renewSession(): Promise<LoginSession | null> {
  const refreshToken = readRefreshToken();

  if (!refreshToken) {
    return Promise.resolve(null);
  }

  if (!inFlight) {
    inFlight = requestNewSession(refreshToken).finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

async function requestNewSession(
  refreshToken: string,
): Promise<LoginSession | null> {
  let response: Response;

  try {
    response = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // The network is down. Keep the tokens so the next request can try again.
    return null;
  }

  if (!response.ok) {
    // A rejected refresh token cannot be reused: close the local session.
    clearSession();
    return null;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    clearSession();
    return null;
  }

  if (!isRefreshResponse(body)) {
    clearSession();
    return null;
  }

  const session: LoginSession = {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };
  saveSession(session);
  return session;
}
