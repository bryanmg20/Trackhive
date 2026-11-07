import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyExistsError } from '../../domain/errors/email-already-exists.error';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserResponseMapper } from '../mappers/user-response.mapper';
import type { PasswordHasher } from '../ports/password-hasher.port';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../tokens';

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: CreateUserInput): Promise<UserResponseDto> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = new User({
      id: randomUUID(),
      fullName: input.fullName,
      email,
      passwordHash,
      // Public registration can only create public accounts
      role: 'PUBLICO',
    });

    await this.userRepo.save(user);
    return UserResponseMapper.toDto(user);
  }
}
