import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../users/application/tokens';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error';
import type { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { LoginResponseDto } from '../dto/login-response.dto';
import type { TokenHasher } from '../ports/token-hasher.port';
import type { TokenService } from '../ports/token-service.port';
import { SessionTokenIssuer } from '../services/session-token-issuer';
import {
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_HASHER,
  TOKEN_SERVICE,
} from '../tokens';

export interface RefreshSessionInput {
  refreshToken: string;
}

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(TOKEN_HASHER) private readonly tokenHasher: TokenHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly sessionTokenIssuer: SessionTokenIssuer,
  ) {}

  async execute(input: RefreshSessionInput): Promise<LoginResponseDto> {
    // Forged, malformed or expired tokens are rejected before the database
    const validSignature = await this.tokenService.verifyRefreshToken(
      input.refreshToken,
    );
    if (!validSignature) {
      throw new InvalidRefreshTokenError();
    }

    const stored = await this.refreshTokens.findByTokenHash(
      this.tokenHasher.hash(input.refreshToken),
    );
    const now = new Date();
    if (!stored || stored.isExpired(now)) {
      throw new InvalidRefreshTokenError();
    }

    // Rotation (D-11): a refresh token works only once. revoke() only
    // succeeds while the token is active, so a second use (a stolen copy, or
    // two requests at the same time) ends here and closes every session
    const revoked = await this.refreshTokens.revoke(stored.id, now);
    if (!revoked) {
      await this.refreshTokens.revokeAllForUser(stored.userId, now);
      throw new InvalidRefreshTokenError();
    }

    // A deactivated account cannot renew its session
    const user = await this.userRepo.findById(stored.userId);
    if (!user || !user.active) {
      throw new InvalidRefreshTokenError();
    }

    return this.sessionTokenIssuer.issue(user);
  }
}
