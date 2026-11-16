/** Hashes refresh tokens so only the hash reaches the database (D-11). */
export interface ITokenHasher {
  hash(token: string): string;
}
