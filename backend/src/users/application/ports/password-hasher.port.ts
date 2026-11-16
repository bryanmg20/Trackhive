/** Hashes plain passwords and checks them against stored hashes. */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
}
