import { Inject, Injectable } from '@nestjs/common';
import type { PasswordHasher } from '../../../users/application/ports/password-hasher.port';
import {
  PASSWORD_HASHER,
  USER_REPOSITORY,
} from '../../../users/application/tokens';
import type { IUserRepository } from '../../../users/domain/repositories/user.repository';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { LoginResponseDto } from '../dto/login-response.dto';
import type { TokenService } from '../ports/token-service.port';
import { TOKEN_SERVICE } from '../tokens';

export interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
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

    const payload = { sub: user.id, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ]);
    return { accessToken, refreshToken };
  }
}
