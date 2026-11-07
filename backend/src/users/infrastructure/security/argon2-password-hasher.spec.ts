import * as argon2 from 'argon2';
import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('stores an argon2 hash that can verify the original password', async () => {
    const password = 'secreto123';

    const hash = await hasher.hash(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$argon2/);
    await expect(argon2.verify(hash, password)).resolves.toBe(true);
  });
});
