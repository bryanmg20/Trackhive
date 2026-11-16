import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { USER_REPOSITORY } from '../../../users/application/tokens';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { Requester } from '../../domain/entities/requester.entity';
import { RequesterEmailMismatchError } from '../../domain/errors/requester-email-mismatch.error';
import { RequesterUserNotFoundError } from '../../domain/errors/requester-user-not-found.error';
import type { IRequesterRepository } from '../../domain/repositories/requester.repository';
import type { RequesterInput } from '../dto/requester.input';
import { REQUESTER_REPOSITORY } from '../tokens';

/**
 * Finds the requester a new request is for, or creates it (HU-09, HU-10).
 * A user account has at most one requester, created from the account the
 * first time with the same four names (issue #96).
 */
@Injectable()
export class RequesterResolver {
  constructor(
    @Inject(REQUESTER_REPOSITORY)
    private readonly requesters: IRequesterRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  /** The requester of a user account (HU-09). */
  async forUser(userId: string): Promise<Requester> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new RequesterUserNotFoundError();
    }
    return this.linkedTo(user);
  }

  /**
   * The person a staff member registers (HU-10): a registered user picked
   * by id, else the oldest requester or user with that email, else a new
   * visitor without an account.
   */
  async forContact(input: RequesterInput): Promise<Requester> {
    const email = input.email.trim().toLowerCase();

    if (input.userId) {
      const user = await this.users.findById(input.userId);
      if (!user) {
        throw new RequesterUserNotFoundError();
      }
      if (user.email.trim().toLowerCase() !== email) {
        throw new RequesterEmailMismatchError();
      }
      return this.linkedTo(user);
    }

    const existing = await this.requesters.findByEmail(email);
    if (existing) {
      return existing;
    }

    const user = await this.users.findByEmail(email);
    if (user) {
      return this.linkedTo(user);
    }

    // Throws RequesterNameRequiredError without the first and last name
    const requester = Requester.fromContact({ ...input, email }, randomUUID());
    await this.requesters.save(requester);
    return requester;
  }

  private async linkedTo(
    user: Parameters<typeof Requester.fromUser>[0],
  ): Promise<Requester> {
    const existing = await this.requesters.findByUserId(user.id);
    if (existing) {
      return existing;
    }
    const requester = Requester.fromUser(user, randomUUID());
    await this.requesters.save(requester);
    return requester;
  }
}
