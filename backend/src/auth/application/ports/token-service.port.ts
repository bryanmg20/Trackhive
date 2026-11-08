import type { UserRole } from '../../../users/domain/user-role';

export interface TokenPayload {
  sub: string;
  role: UserRole;
}

export interface SignedToken {
  token: string;
  expiresAt: Date;
}

/** Signs and checks the session tokens without the use cases knowing about JWT. */
export interface TokenService {
  signAccessToken(payload: TokenPayload): Promise<string>;
  signRefreshToken(payload: TokenPayload): Promise<SignedToken>;
  /** True only for a refresh token signed by us that has not expired. */
  verifyRefreshToken(token: string): Promise<boolean>;
}
