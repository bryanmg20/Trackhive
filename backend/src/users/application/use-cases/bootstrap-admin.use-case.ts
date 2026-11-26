import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { WeakAdminPasswordError } from '../../domain/errors/weak-admin-password.error';
import { isStrongAdminPassword } from '../../domain/policies/initial-admin-password';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import type { BootstrapAdminInput } from '../dto/bootstrap-admin.input';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../tokens';

/**
 * Creates the initial administrator from the .env when the app starts
 * (HU-42), only if there is no ADMIN account at all, active or not. Once one
 * exists it does nothing: it never resets a password nor reactivates an
 * account. Returns whether it created the account.
 */
@Injectable()
export class BootstrapAdminUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: BootstrapAdminInput): Promise<boolean> {
    // Checked on every start, so a weak production .env fails right away
    if (input.requireStrongPassword && !isStrongAdminPassword(input.password)) {
      throw new WeakAdminPasswordError();
    }

    if (await this.userRepo.findFirstByRole('ADMIN')) {
      return false;
    }

    const email = input.email.trim().toLowerCase();
    // Another account already has that email: it is not turned into an ADMIN
    if (await this.userRepo.findByEmail(email)) {
      throw new EmailAlreadyExistsError();
    }

    await this.userRepo.save(
      User.createInitialAdmin({
        id: randomUUID(),
        email,
        passwordHash: await this.passwordHasher.hash(input.password),
      }),
    );
    return true;
  }
}
