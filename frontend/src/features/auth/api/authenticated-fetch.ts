import { readAccessToken } from '../session';
import { renewSession } from './refresh-session';

function withAccessToken(
  init: RequestInit,
  accessToken: string | null,
): RequestInit {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    delete headers.Authorization;
  }

  return { ...init, headers };
}

/**
 * Calls a protected endpoint with the current access token.
 *
 * When the token has expired the backend answers 401. The session is renewed
 * once with the refresh token and the original request is retried, so the
 * person keeps working without signing in again. The `/auth/refresh`
 * endpoint itself must not use this helper to avoid a renewal loop.
 */
export async function authenticatedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  let response = await fetch(input, withAccessToken(init, readAccessToken()));

  if (response.status !== 401) {
    return response;
  }

  const session = await renewSession();
  if (!session) {
    return response;
  }

  response = await fetch(input, withAccessToken(init, session.accessToken));
  return response;
}
