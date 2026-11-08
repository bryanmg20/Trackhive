import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type {
  SignedToken,
  TokenPayload,
  TokenService,
} from '../../application/ports/token-service.port';

// D-11: short-lived access token, long-lived refresh token
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: TokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }

  async signRefreshToken(payload: TokenPayload): Promise<SignedToken> {
    const token = await this.jwt.signAsync(payload, {
      secret: this.refreshSecret(),
      expiresIn: REFRESH_TOKEN_TTL,
      // Random id (jti): without it, two tokens for the same user signed in
      // the same second would be identical, and rotation would not work
      jwtid: randomUUID(),
    });
    // The database keeps the same expiry that the token carries
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  async verifyRefreshToken(token: string): Promise<boolean> {
    try {
      // Also rejects access tokens: they are signed with another secret
      await this.jwt.verifyAsync(token, { secret: this.refreshSecret() });
      return true;
    } catch {
      // Bad signature, malformed or expired
      return false;
    }
  }

  private refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }
}
