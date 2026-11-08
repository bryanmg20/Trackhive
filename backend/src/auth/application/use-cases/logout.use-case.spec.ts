import { LogoutUseCase } from './logout.use-case';
import { InMemoryRefreshTokenRepository } from '../../../../test/fakes/in-memory-refresh-token.repository';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import type { TokenHasher } from '../ports/token-hasher.port';

const tokenHasher: TokenHasher = { hash: (token) => `sha256:${token}` };

describe('LogoutUseCase', () => {
  let refreshTokens: InMemoryRefreshTokenRepository;
  let useCase: LogoutUseCase;

  const storeToken = (token: string): Promise<void> =>
    refreshTokens.save(
      new RefreshToken({
        id: `id-${token}`,
        userId: 'user-1',
        tokenHash: tokenHasher.hash(token),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }),
    );

  const revokedAtOf = async (token: string): Promise<Date | null | undefined> =>
    (await refreshTokens.findByTokenHash(tokenHasher.hash(token)))?.revokedAt;

  beforeEach(() => {
    refreshTokens = new InMemoryRefreshTokenRepository();
    useCase = new LogoutUseCase(tokenHasher, refreshTokens);
  });

  it('revokes the refresh token of the session', async () => {
    await storeToken('refresh-login');

    await useCase.execute({ refreshToken: 'refresh-login' });

    expect(await revokedAtOf('refresh-login')).toBeInstanceOf(Date);
  });

  it('keeps the other sessions of the user open', async () => {
    await storeToken('refresh-login');
    await storeToken('refresh-other-device');

    await useCase.execute({ refreshToken: 'refresh-login' });

    expect(await revokedAtOf('refresh-other-device')).toBeNull();
  });

  it('does not fail for an unknown or already revoked token', async () => {
    await storeToken('refresh-login');
    await useCase.execute({ refreshToken: 'refresh-login' });

    await expect(
      useCase.execute({ refreshToken: 'refresh-login' }),
    ).resolves.toBeUndefined();
    await expect(
      useCase.execute({ refreshToken: 'refresh-unknown' }),
    ).resolves.toBeUndefined();
  });
});
