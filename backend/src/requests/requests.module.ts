import { Module } from '@nestjs/common';
import { REQUEST_REPOSITORY } from './application/tokens';
import { ChangeRequestStatusUseCase } from './application/use-cases/change-request-status.use-case';
import { CreateRequestOnBehalfUseCase } from './application/use-cases/create-request-on-behalf.use-case';
import { CreateRequestUseCase } from './application/use-cases/create-request.use-case';
import { FindRequesterByEmailUseCase } from './application/use-cases/find-requester-by-email.use-case';
import { GetRequestDetailUseCase } from './application/use-cases/get-request-detail.use-case';
import { ListAppointmentsUseCase } from './application/use-cases/list-appointments.use-case';
import { ListMyRequestsUseCase } from './application/use-cases/list-my-requests.use-case';
import { ListRequestsUseCase } from './application/use-cases/list-requests.use-case';
import { ScheduleAppointmentUseCase } from './application/use-cases/schedule-appointment.use-case';
import { PrismaRequestRepository } from './infrastructure/persistence/prisma-request.repository';
import { AppointmentController } from './presentation/controllers/appointment.controller';
import { RequestController } from './presentation/controllers/request.controller';
import { RequesterController } from './presentation/controllers/requester.controller';

@Module({
  controllers: [RequestController, RequesterController, AppointmentController],
  providers: [
    { provide: REQUEST_REPOSITORY, useClass: PrismaRequestRepository },
    CreateRequestUseCase,
    CreateRequestOnBehalfUseCase,
    FindRequesterByEmailUseCase,
    ListRequestsUseCase,
    ListAppointmentsUseCase,
    GetRequestDetailUseCase,
    ListMyRequestsUseCase,
    ChangeRequestStatusUseCase,
    ScheduleAppointmentUseCase,
  ],
})
export class RequestsModule {}
