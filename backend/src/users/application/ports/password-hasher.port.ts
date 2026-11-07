/** Hashes plain passwords before they reach persistence. */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
}
