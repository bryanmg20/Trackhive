import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { TOKEN_SERVICE } from './application/tokens';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
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
    LoginUseCase,
  ],
})
export class AuthModule {}
