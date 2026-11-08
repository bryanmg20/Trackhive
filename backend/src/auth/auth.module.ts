import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { SessionTokenIssuer } from './application/services/session-token-issuer';
import {
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_HASHER,
  TOKEN_SERVICE,
} from './application/tokens';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { Sha256TokenHasher } from './infrastructure/security/sha256-token-hasher';
import { AuthController } from './presentation/controllers/auth.controller';

@Module({
  // Secrets and lifetimes are passed per token in JwtTokenService
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
    {
      provide: TOKEN_HASHER,
      useClass: Sha256TokenHasher,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    SessionTokenIssuer,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
  ],
})
export class AuthModule {}
