import { PurgeExpiredTokensUseCase } from './purge-expired-tokens.use-case';
import { InMemoryRefreshTokenRepository } from '../../../../test/fakes/in-memory-refresh-token.repository';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';

const NOW = new Date('2026-11-08T08:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

describe('PurgeExpiredTokensUseCase', () => {
  let refreshTokens: InMemoryRefreshTokenRepository;
  let useCase: PurgeExpiredTokensUseCase;

  const storeToken = (
    id: string,
    expiresInMs: number,
    revokedAt: Date | null = null,
  ): Promise<void> =>
    refreshTokens.save(
      new RefreshToken({
        id,
        userId: 'user-1',
        tokenHash: `hash-${id}`,
        expiresAt: new Date(NOW.getTime() + expiresInMs),
        revokedAt,
      }),
    );

  const storedIds = (): string[] =>
    refreshTokens
      .findAll()
      .map((token) => token.id)
      .sort();

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    refreshTokens = new InMemoryRefreshTokenRepository();
    useCase = new PurgeExpiredTokensUseCase(refreshTokens);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deletes expired tokens, whether they were revoked or not', async () => {
    await storeToken('expired', -HOUR_MS);
    await storeToken(
      'expired-revoked',
      -HOUR_MS,
      new Date(NOW.getTime() - 2 * HOUR_MS),
    );
    await storeToken('expires-now', 0);

    await expect(useCase.execute()).resolves.toBe(3);
    expect(storedIds()).toEqual([]);
  });

  it('keeps revoked tokens that have not expired, so reuse can still be detected', async () => {
    await storeToken('revoked', HOUR_MS, new Date(NOW.getTime() - HOUR_MS));

    await expect(useCase.execute()).resolves.toBe(0);
    expect(storedIds()).toEqual(['revoked']);
  });

  it('keeps valid tokens', async () => {
    await storeToken('valid', 7 * 24 * HOUR_MS);
    await storeToken('expired', -1);

    await expect(useCase.execute()).resolves.toBe(1);
    expect(storedIds()).toEqual(['valid']);
  });
});
