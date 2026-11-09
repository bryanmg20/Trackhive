import { Module } from '@nestjs/common';
import { REQUEST_REPOSITORY } from './application/tokens';
import { CreateRequestUseCase } from './application/use-cases/create-request.use-case';
import { PrismaRequestRepository } from './infrastructure/persistence/prisma-request.repository';
import { RequestController } from './presentation/controllers/request.controller';

@Module({
  controllers: [RequestController],
  providers: [
    { provide: REQUEST_REPOSITORY, useClass: PrismaRequestRepository },
    CreateRequestUseCase,
  ],
})
export class RequestsModule {}
