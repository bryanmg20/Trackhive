import { RefreshToken } from '../entities/refresh-token.entity';

export interface IRefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  /**
   * Revokes the token only if it is still active, in one atomic step.
   * Returns false if it was already revoked, so two requests with the same
   * token can never both succeed.
   */
  revoke(id: string, revokedAt: Date): Promise<boolean>;
  /** Revokes every active token of the user: closes all their sessions. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<void>;
}
