import type { UserRole } from '../../../users/domain/user-role';

export interface TokenPayload {
  sub: string;
  role: UserRole;
}

/** Signs the session tokens without the use case knowing about JWT. */
export interface TokenService {
  signAccessToken(payload: TokenPayload): Promise<string>;
  signRefreshToken(payload: TokenPayload): Promise<string>;
}
