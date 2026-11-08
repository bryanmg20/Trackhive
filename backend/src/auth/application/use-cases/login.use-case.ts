import { Inject, Injectable } from '@nestjs/common';
import type { PasswordHasher } from '../../../users/application/ports/password-hasher.port';
import {
  PASSWORD_HASHER,
  USER_REPOSITORY,
} from '../../../users/application/tokens';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { LoginResponseDto } from '../dto/login-response.dto';
import { SessionTokenIssuer } from '../services/session-token-issuer';

export interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokenIssuer: SessionTokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginResponseDto> {
    const user = await this.userRepo.findByEmail(
      input.email.trim().toLowerCase(),
    );
    // Only active accounts can sign in
    if (!user || !user.active) {
      throw new InvalidCredentialsError();
    }

    const validPassword = await this.passwordHasher.verify(
      input.password,
      user.passwordHash,
    );
    if (!validPassword) {
      throw new InvalidCredentialsError();
    }

    // Stores the refresh token too, so it can be renewed and revoked (HU-03)
    return this.sessionTokenIssuer.issue(user);
  }
}
