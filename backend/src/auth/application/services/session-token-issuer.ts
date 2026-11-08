import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { User } from '../../../users/domain/entities/user.entity';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import type { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { LoginResponseDto } from '../dto/login-response.dto';
import type { TokenHasher } from '../ports/token-hasher.port';
import type { TokenService } from '../ports/token-service.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_HASHER,
  TOKEN_SERVICE,
} from '../tokens';

/**
 * Opens a session: signs a new token pair and stores the hash of the
 * refresh token so it can be renewed or revoked later. Login and refresh
 * both open sessions this way.
 */
@Injectable()
export class SessionTokenIssuer {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(TOKEN_HASHER) private readonly tokenHasher: TokenHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
  ) {}

  async issue(user: User): Promise<LoginResponseDto> {
    // The role comes from the stored user, so a role change applies on the next renewal
    const payload = { sub: user.id, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ]);

    await this.refreshTokens.save(
      new RefreshToken({
        id: randomUUID(),
        userId: user.id,
        tokenHash: this.tokenHasher.hash(refreshToken.token),
        expiresAt: refreshToken.expiresAt,
        revokedAt: null,
      }),
    );

    return { accessToken, refreshToken: refreshToken.token };
  }
}
