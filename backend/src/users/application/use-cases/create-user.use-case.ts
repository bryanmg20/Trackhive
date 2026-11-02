import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { User } from '../../domain/entities/user.entity';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import { USER_REPOSITORY } from '../tokens';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserResponseMapper } from '../mappers/user-response.mapper';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(email: string): Promise<UserResponseDto> {
    const user = new User(randomUUID(), email);
    await this.userRepo.save(user);
    return UserResponseMapper.toDto(user);
  }
}
