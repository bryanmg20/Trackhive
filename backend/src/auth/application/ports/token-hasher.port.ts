/** Hashes refresh tokens so only the hash reaches the database (D-11). */
export interface TokenHasher {
  hash(token: string): string;
}
