import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { TokenHasher } from '../../application/ports/token-hasher.port';

/**
 * SHA-256 and not argon2: the token is long and random, so it cannot be
 * guessed like a password, and the same token always gives the same hash,
 * which is what lets us look it up.
 */
@Injectable()
export class Sha256TokenHasher implements TokenHasher {
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
