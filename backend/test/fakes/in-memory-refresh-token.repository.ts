import { RefreshToken } from '../../src/auth/domain/entities/refresh-token.entity';
import type { IRefreshTokenRepository } from '../../src/auth/domain/repositories/refresh-token.repository';

/** Fake for unit and e2e tests (D-21). It behaves like the Prisma repository. */
export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshToken>();

  save(token: RefreshToken): Promise<void> {
    this.tokens.set(token.id, token);
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const token = [...this.tokens.values()].find(
      (candidate) => candidate.tokenHash === tokenHash,
    );
    return Promise.resolve(token ?? null);
  }

  revoke(id: string, revokedAt: Date): Promise<boolean> {
    const token = this.tokens.get(id);
    if (!token || token.revokedAt) {
      return Promise.resolve(false);
    }
    this.tokens.set(id, new RefreshToken({ ...token, revokedAt }));
    return Promise.resolve(true);
  }

  revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.userId === userId && !token.revokedAt) {
        this.tokens.set(token.id, new RefreshToken({ ...token, revokedAt }));
      }
    }
    return Promise.resolve();
  }

  findAll(): RefreshToken[] {
    return [...this.tokens.values()];
  }
}
