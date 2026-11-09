import { RefreshSessionUseCase } from './refresh-session.use-case';
import { InMemoryRefreshTokenRepository } from '../../../../test/fakes/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from '../../../../test/fakes/in-memory-user.repository';
import { User, UserProps } from '../../../users/domain/entities/user.entity';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error';
import type { TokenHasher } from '../ports/token-hasher.port';
import type {
  SignedToken,
  TokenPayload,
  TokenService,
} from '../ports/token-service.port';
import { SessionTokenIssuer } from '../services/session-token-issuer';

const DAY_MS = 24 * 60 * 60 * 1000;

const tokenHasher: TokenHasher = { hash: (token) => `sha256:${token}` };

/** Readable tokens; only the ones that start with "refresh-" pass the signature check. */
class FakeTokenService implements TokenService {
  private issued = 0;

  signAccessToken(payload: TokenPayload): Promise<string> {
    this.issued += 1;
    return Promise.resolve(`access-${payload.role}-${this.issued}`);
  }

  signRefreshToken(): Promise<SignedToken> {
    this.issued += 1;
    return Promise.resolve({
      token: `refresh-${this.issued}`,
      expiresAt: new Date(Date.now() + 7 * DAY_MS),
    });
  }

  verifyRefreshToken(token: string): Promise<boolean> {
    return Promise.resolve(token.startsWith('refresh-'));
  }

  // Not used by the renewal: only the guards check access tokens (HU-04)
  verifyAccessToken(): Promise<TokenPayload | null> {
    return Promise.resolve(null);
  }
}

const buildUser = (overrides: Partial<UserProps> = {}): User =>
  new User({
    id: 'user-1',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@mail.com',
    passwordHash: 'hashed:secreto123',
    role: 'PUBLICO',
    active: true,
    ...overrides,
  });

describe('RefreshSessionUseCase', () => {
  let users: InMemoryUserRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let useCase: RefreshSessionUseCase;

  /** Stores a token of user-1 as if login had issued it. */
  const storeToken = (
    token: string,
    overrides: { expiresAt?: Date; revokedAt?: Date } = {},
  ): Promise<void> =>
    refreshTokens.save(
      new RefreshToken({
        id: `id-${token}`,
        userId: 'user-1',
        tokenHash: tokenHasher.hash(token),
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + DAY_MS),
        revokedAt: overrides.revokedAt ?? null,
      }),
    );

  const revokedAtOf = async (token: string): Promise<Date | null | undefined> =>
    (await refreshTokens.findByTokenHash(tokenHasher.hash(token)))?.revokedAt;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    await users.save(buildUser());
    refreshTokens = new InMemoryRefreshTokenRepository();
    const tokenService = new FakeTokenService();
    useCase = new RefreshSessionUseCase(
      tokenService,
      tokenHasher,
      refreshTokens,
      users,
      new SessionTokenIssuer(tokenService, tokenHasher, refreshTokens),
    );
  });

  it('returns a new access token and a new refresh token for a valid refresh token', async () => {
    await storeToken('refresh-login');

    const tokens = await useCase.execute({ refreshToken: 'refresh-login' });

    expect(tokens.accessToken).toMatch(/^access-PUBLICO-/);
    expect(tokens.refreshToken).toMatch(/^refresh-/);
    expect(tokens.refreshToken).not.toBe('refresh-login');
  });

  it('revokes the token it receives and stores the new one', async () => {
    await storeToken('refresh-login');

    const tokens = await useCase.execute({ refreshToken: 'refresh-login' });

    expect(await revokedAtOf('refresh-login')).toBeInstanceOf(Date);
    expect(await revokedAtOf(tokens.refreshToken)).toBeNull();
  });

  it('signs the new access token with the current role of the user', async () => {
    await storeToken('refresh-login');
    await users.save(buildUser({ role: 'PERSONAL' }));

    const tokens = await useCase.execute({ refreshToken: 'refresh-login' });

    expect(tokens.accessToken).toMatch(/^access-PERSONAL-/);
  });

  it('rejects a stored token whose JWT no longer verifies (expired or signed with an old secret)', async () => {
    await storeToken('stale-token');

    await expect(
      useCase.execute({ refreshToken: 'stale-token' }),
    ).rejects.toThrow(InvalidRefreshTokenError);
    expect(await revokedAtOf('stale-token')).toBeNull();
  });

  it('rejects a token that was never issued', async () => {
    await expect(
      useCase.execute({ refreshToken: 'refresh-unknown' }),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects a stored token past its expiry date', async () => {
    await storeToken('refresh-old', {
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      useCase.execute({ refreshToken: 'refresh-old' }),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects a revoked token', async () => {
    await storeToken('refresh-closed', { revokedAt: new Date() });

    await expect(
      useCase.execute({ refreshToken: 'refresh-closed' }),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('closes every session of the user when a used token comes back', async () => {
    await storeToken('refresh-login');
    await storeToken('refresh-other-device');
    const tokens = await useCase.execute({ refreshToken: 'refresh-login' });

    // Someone copied the first token and uses it after the user renewed
    await expect(
      useCase.execute({ refreshToken: 'refresh-login' }),
    ).rejects.toThrow(InvalidRefreshTokenError);

    expect(await revokedAtOf(tokens.refreshToken)).toBeInstanceOf(Date);
    expect(await revokedAtOf('refresh-other-device')).toBeInstanceOf(Date);
  });

  it('renews only once when two requests use the same token at the same time', async () => {
    await storeToken('refresh-login');

    const results = await Promise.allSettled([
      useCase.execute({ refreshToken: 'refresh-login' }),
      useCase.execute({ refreshToken: 'refresh-login' }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
  });

  it('rejects the token of a deactivated account', async () => {
    await storeToken('refresh-login');
    await users.save(buildUser({ active: false }));

    await expect(
      useCase.execute({ refreshToken: 'refresh-login' }),
    ).rejects.toThrow(InvalidRefreshTokenError);
    expect(refreshTokens.findAll().every((token) => token.revokedAt)).toBe(
      true,
    );
  });
});
