import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service';
import type { TokenPayload } from '../../application/ports/token-service.port';

const REFRESH_SECRET = 'refresh-secret';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('JwtTokenService', () => {
  const jwt = new JwtService();
  const service = new JwtTokenService(
    jwt,
    new ConfigService({
      JWT_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: REFRESH_SECRET,
    }),
  );
  const payload: TokenPayload = { sub: 'user-1', role: 'PUBLICO' };

  it('signs a different refresh token every time, even in the same second', async () => {
    const [first, second] = await Promise.all([
      service.signRefreshToken(payload),
      service.signRefreshToken(payload),
    ]);

    expect(first.token).not.toBe(second.token);
  });

  it('returns the same expiry date that the refresh token carries', async () => {
    const before = Date.now();

    const { token, expiresAt } = await service.signRefreshToken(payload);

    const { exp } = jwt.decode<{ exp: number }>(token);
    expect(expiresAt.getTime()).toBe(exp * 1000);
    expect(expiresAt.getTime() - before).toBeGreaterThan(SEVEN_DAYS_MS - 2000);
  });

  it('accepts a refresh token it signed', async () => {
    const { token } = await service.signRefreshToken(payload);

    await expect(service.verifyRefreshToken(token)).resolves.toBe(true);
  });

  it('rejects access tokens, expired tokens and text that is not a JWT', async () => {
    const accessToken = await service.signAccessToken(payload);
    const expiredToken = await jwt.signAsync(
      { ...payload, exp: Math.floor(Date.now() / 1000) - 10 },
      { secret: REFRESH_SECRET },
    );

    await expect(service.verifyRefreshToken(accessToken)).resolves.toBe(false);
    await expect(service.verifyRefreshToken(expiredToken)).resolves.toBe(false);
    await expect(service.verifyRefreshToken('no-es-un-jwt')).resolves.toBe(
      false,
    );
  });
});
