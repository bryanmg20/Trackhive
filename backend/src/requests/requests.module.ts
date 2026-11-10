import { Module } from '@nestjs/common';
import { REQUEST_REPOSITORY } from './application/tokens';
import { ChangeRequestStatusUseCase } from './application/use-cases/change-request-status.use-case';
import { CreateRequestOnBehalfUseCase } from './application/use-cases/create-request-on-behalf.use-case';
import { CreateRequestUseCase } from './application/use-cases/create-request.use-case';
import { FindRequesterByEmailUseCase } from './application/use-cases/find-requester-by-email.use-case';
import { GetRequestDetailUseCase } from './application/use-cases/get-request-detail.use-case';
import { ListMyRequestsUseCase } from './application/use-cases/list-my-requests.use-case';
import { ListRequestsUseCase } from './application/use-cases/list-requests.use-case';
import { PrismaRequestRepository } from './infrastructure/persistence/prisma-request.repository';
import { RequestController } from './presentation/controllers/request.controller';
import { RequesterController } from './presentation/controllers/requester.controller';

@Module({
  controllers: [RequestController, RequesterController],
  providers: [
    { provide: REQUEST_REPOSITORY, useClass: PrismaRequestRepository },
    CreateRequestUseCase,
    CreateRequestOnBehalfUseCase,
    FindRequesterByEmailUseCase,
    ListRequestsUseCase,
    GetRequestDetailUseCase,
    ListMyRequestsUseCase,
    ChangeRequestStatusUseCase,
  ],
})
export class RequestsModule {}
