export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * A session opened by login or by a renewal. Only the hash of the token is
 * kept (D-11), so a database leak does not hand out valid sessions.
 */
export class RefreshToken {
  public readonly id: string;
  public readonly userId: string;
  public readonly tokenHash: string;
  public readonly expiresAt: Date;
  /** `null` while the token is still valid. */
  public readonly revokedAt: Date | null;

  constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
  }

  isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }
}
