import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { IPasswordHasher } from '../../application/ports/password-hasher.port';

@Injectable()
export class Argon2PasswordHasher implements IPasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword);
  }

  verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return argon2.verify(passwordHash, plainPassword);
  }
}
