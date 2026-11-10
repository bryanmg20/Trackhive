import { clearSession, readRefreshToken } from '../session';
import { apiUrl } from './api-base-url';

/**
 * Closes the session: asks the backend to revoke the refresh token and always
 * clears the local tokens. A network failure must not keep the person signed
 * in on this device.
 */
export async function logoutSession(): Promise<void> {
  const refreshToken = readRefreshToken();

  try {
    if (refreshToken) {
      await fetch(apiUrl('/api/v1/auth/logout'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // The local session is closed even when the backend cannot be reached.
  } finally {
    clearSession();
  }
}
