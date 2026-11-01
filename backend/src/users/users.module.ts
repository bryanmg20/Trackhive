import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from './application/tokens';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { UserController } from './presentation/controllers/user.controller';

@Module({
  controllers: [UserController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    CreateUserUseCase,
  ],
})
export class UsersModule {}
