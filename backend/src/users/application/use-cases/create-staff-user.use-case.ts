import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import type { CreateStaffUserInput } from '../dto/create-staff-user.input';
import { StaffUserResponseDto } from '../dto/staff-user-response.dto';
import { StaffUserResponseMapper } from '../mappers/staff-user-response.mapper';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../tokens';

/** An administrator creates a PERSONAL account (HU-05). */
@Injectable()
export class CreateStaffUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: CreateStaffUserInput): Promise<StaffUserResponseDto> {
    const email = input.email.trim().toLowerCase();
    if (await this.userRepo.findByEmail(email)) {
      throw new EmailAlreadyExistsError();
    }

    // The entity makes it PERSONAL and active, so it can sign in with the
    // initial password right away
    const user = User.createStaff({
      id: randomUUID(),
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      secondLastName: input.secondLastName,
      email,
      passwordHash: await this.passwordHasher.hash(input.password),
    });

    await this.userRepo.save(user);
    return StaffUserResponseMapper.toDto(user);
  }
}
