import { Inject, Injectable } from '@nestjs/common';
import type { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { REFRESH_TOKEN_REPOSITORY } from '../tokens';

/**
 * Deletes the refresh tokens that already expired (HU-3.1).
 *
 * Revoked tokens that have not expired yet are kept: they are what lets
 * RefreshSessionUseCase detect that a copied token is being reused (D-11).
 * Once expired, a token is rejected by its signature check before the
 * database is read, so its row is no longer needed.
 */
@Injectable()
export class PurgeExpiredTokensUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
  ) {}

  /** Returns how many tokens were deleted. */
  execute(): Promise<number> {
    return this.refreshTokens.deleteExpired(new Date());
  }
}
