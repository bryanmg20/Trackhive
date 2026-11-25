import { Module } from '@nestjs/common';
import { PASSWORD_HASHER, USER_REPOSITORY } from './application/tokens';
import { BootstrapAdminUseCase } from './application/use-cases/bootstrap-admin.use-case';
import { CreateStaffUserUseCase } from './application/use-cases/create-staff-user.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { ListStaffUsersUseCase } from './application/use-cases/list-staff-users.use-case';
import { UpdateStaffUserUseCase } from './application/use-cases/update-staff-user.use-case';
import { BootstrapAdminJob } from './infrastructure/jobs/bootstrap-admin.job';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { StaffUserController } from './presentation/controllers/staff-user.controller';
import { UserController } from './presentation/controllers/user.controller';
import { ACCOUNT_REGISTRATION } from './application/tokens';
import { PrismaAccountRegistration } from './infrastructure/persistence/prisma-account-registration';

@Module({
  controllers: [UserController, StaffUserController],
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
    // Staff accounts management (HU-05)
    ListStaffUsersUseCase,
    CreateStaffUserUseCase,
    UpdateStaffUserUseCase,
    // Initial administrator from the .env, when the app starts (HU-42)
    BootstrapAdminUseCase,
    BootstrapAdminJob,
  ],
  // Login (AuthModule) reuses the user lookup and the password check
  exports: [USER_REPOSITORY, PASSWORD_HASHER],
})
export class UsersModule {}
