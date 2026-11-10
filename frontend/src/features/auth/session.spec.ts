import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  isAccessTokenExpired,
  readRefreshToken,
  readRoleFromToken,
  readSessionRole,
  saveSession,
} from './session';

function tokenWithRole(role: string, expiresInSeconds: number): string {
  const payload = btoa(
    JSON.stringify({
      role,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
  );
  return `header.${payload}.signature`;
}

describe('session', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and clears both tokens', () => {
    saveSession({ accessToken: 'access', refreshToken: 'refresh' });

    expect(readRefreshToken()).toBe('refresh');

    clearSession();

    expect(readRefreshToken()).toBeNull();
    expect(readSessionRole()).toBeNull();
  });

  it('reads the role of an expired access token', () => {
    const token = tokenWithRole('ADMIN', -60);

    expect(readRoleFromToken(token)).toBe('ADMIN');
    expect(isAccessTokenExpired(token)).toBe(true);
  });

  it('rejects a token without a known role', () => {
    const token = tokenWithRole('OTHER', 60);

    expect(readRoleFromToken(token)).toBeNull();
  });
});
