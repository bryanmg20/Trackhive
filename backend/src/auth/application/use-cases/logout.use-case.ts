import { Inject, Injectable } from '@nestjs/common';
import type { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import type { TokenHasher } from '../ports/token-hasher.port';
import { REFRESH_TOKEN_REPOSITORY, TOKEN_HASHER } from '../tokens';

export interface LogoutInput {
  refreshToken: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(TOKEN_HASHER) private readonly tokenHasher: TokenHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: IRefreshTokenRepository,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const stored = await this.refreshTokens.findByTokenHash(
      this.tokenHasher.hash(input.refreshToken),
    );
    // As in RFC 7009, an unknown or already revoked token is not an error:
    // there is no session left to close
    if (stored) {
      await this.refreshTokens.revoke(stored.id, new Date());
    }
  }
}
