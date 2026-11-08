import { RefreshToken } from './refresh-token.entity';

const EXPIRES_AT = new Date('2026-11-14T15:00:00.000Z');

const buildToken = (): RefreshToken =>
  new RefreshToken({
    id: 'token-1',
    userId: 'user-1',
    tokenHash: 'hash',
    expiresAt: EXPIRES_AT,
    revokedAt: null,
  });

describe('RefreshToken', () => {
  it('is not expired before its expiry date', () => {
    expect(buildToken().isExpired(new Date('2026-11-14T14:59:59.999Z'))).toBe(
      false,
    );
  });

  it('is expired from its expiry date on', () => {
    expect(buildToken().isExpired(EXPIRES_AT)).toBe(true);
    expect(buildToken().isExpired(new Date('2026-11-20T00:00:00.000Z'))).toBe(
      true,
    );
  });
});
