import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RequesterResolver } from './application/services/requester-resolver';
import {
  REQUEST_QUERY_SERVICE,
  REQUEST_REPOSITORY,
  REQUESTER_REPOSITORY,
  TRACKING_CODE_GENERATOR,
} from './application/tokens';
import { ChangeRequestStatusUseCase } from './application/use-cases/change-request-status.use-case';
import { CreateRequestOnBehalfUseCase } from './application/use-cases/create-request-on-behalf.use-case';
import { CreateRequestUseCase } from './application/use-cases/create-request.use-case';
import { FindRequesterByEmailUseCase } from './application/use-cases/find-requester-by-email.use-case';
import { GetRequestDetailUseCase } from './application/use-cases/get-request-detail.use-case';
import { GetRequestHistoryUseCase } from './application/use-cases/get-request-history.use-case';
import { ListAppointmentsUseCase } from './application/use-cases/list-appointments.use-case';
import { ListMyRequestsUseCase } from './application/use-cases/list-my-requests.use-case';
import { ListRequestsUseCase } from './application/use-cases/list-requests.use-case';
import { ScheduleAppointmentUseCase } from './application/use-cases/schedule-appointment.use-case';
import { PrismaRequestQueryService } from './infrastructure/persistence/prisma-request-query.service';
import { PrismaRequestRepository } from './infrastructure/persistence/prisma-request.repository';
import { PrismaRequesterRepository } from './infrastructure/persistence/prisma-requester.repository';
import { PrismaTrackingCodeGenerator } from './infrastructure/persistence/prisma-tracking-code.generator';
import { AppointmentController } from './presentation/controllers/appointment.controller';
import { RequestController } from './presentation/controllers/request.controller';
import { RequesterController } from './presentation/controllers/requester.controller';

@Module({
  // USER_REPOSITORY: the requester of a user account (HU-09, HU-10)
  imports: [UsersModule],
  controllers: [RequestController, RequesterController, AppointmentController],
  providers: [
    { provide: REQUEST_REPOSITORY, useClass: PrismaRequestRepository },
    { provide: REQUEST_QUERY_SERVICE, useClass: PrismaRequestQueryService },
    { provide: REQUESTER_REPOSITORY, useClass: PrismaRequesterRepository },
    { provide: TRACKING_CODE_GENERATOR, useClass: PrismaTrackingCodeGenerator },
    RequesterResolver,
    CreateRequestUseCase,
    CreateRequestOnBehalfUseCase,
    FindRequesterByEmailUseCase,
    ListRequestsUseCase,
    ListAppointmentsUseCase,
    GetRequestDetailUseCase,
    GetRequestHistoryUseCase,
    ListMyRequestsUseCase,
    ChangeRequestStatusUseCase,
    ScheduleAppointmentUseCase,
  ],
})
export class RequestsModule {}
