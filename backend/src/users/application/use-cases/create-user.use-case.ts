import { Inject, Injectable } from '@nestjs/common';
import type { CreateUserInput } from '../dto/create-user.input';
import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import { PrivacyConsentRequiredError } from '../../domain/errors/privacy-consent-required.error';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../domain/policies/privacy-policy';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserResponseMapper } from '../mappers/user-response.mapper';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../tokens';
import { ACCOUNT_REGISTRATION } from '../tokens';
import type { IAccountRegistration } from '../ports/account-registration.port';
import { Requester } from '../../../requests/domain/entities/requester.entity';
import { Characterization } from '../../../requests/domain/value-objects/characterization';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(ACCOUNT_REGISTRATION)
    private readonly registration: IAccountRegistration,
  ) {}

  async execute(input: CreateUserInput): Promise<UserResponseDto> {
    if (
      !input.acceptedPrivacy ||
      input.privacyPolicyVersion?.trim() !== CURRENT_PRIVACY_POLICY_VERSION
    ) {
      throw new PrivacyConsentRequiredError();
    }

    const characterization = new Characterization(input);
    const email = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = new User({
      id: randomUUID(),
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      secondLastName: input.secondLastName,
      email,
      passwordHash,
      // Public registration can only create public accounts
      role: 'PUBLICO',
      active: true,
      // The server stamps the acceptance time; it never trusts a client clock
      privacyPolicyAcceptedAt: new Date(),
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    });

    const requester = Requester.fromUser(
      user,
      randomUUID(),
    ).withCharacterization(characterization);
    await this.registration.save(user, requester);
    return UserResponseMapper.toDto(user);
  }
}
