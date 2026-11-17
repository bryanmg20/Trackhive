import { Module } from '@nestjs/common';
import { PASSWORD_HASHER, USER_REPOSITORY } from './application/tokens';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { UserController } from './presentation/controllers/user.controller';
import { ACCOUNT_REGISTRATION } from './application/tokens';
import { PrismaAccountRegistration } from './infrastructure/persistence/prisma-account-registration';

@Module({
  controllers: [UserController],
  providers: [
    { provide: ACCOUNT_REGISTRATION, useClass: PrismaAccountRegistration },
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    CreateUserUseCase,
  ],
  // Login (AuthModule) reuses the user lookup and the password check
  exports: [USER_REPOSITORY, PASSWORD_HASHER],
})
export class UsersModule {}
