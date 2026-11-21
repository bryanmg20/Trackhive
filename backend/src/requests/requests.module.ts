import { Module } from '@nestjs/common';
import { MaterialsModule } from '../materials/materials.module';
import { UsersModule } from '../users/users.module';
import { RequesterResolver } from './application/services/requester-resolver';
import {
  REQUEST_QUERY_SERVICE,
  REQUEST_REPOSITORY,
  REQUESTER_REPOSITORY,
  ROOM_CAPACITY_REPOSITORY,
  TRACKING_CODE_GENERATOR,
} from './application/tokens';
import { CancelAppointmentUseCase } from './application/use-cases/cancel-appointment.use-case';
import { ChangeRequestStatusUseCase } from './application/use-cases/change-request-status.use-case';
import { DeliverMaterialUseCase } from './application/use-cases/deliver-material.use-case';
import { CreateRequestOnBehalfUseCase } from './application/use-cases/create-request-on-behalf.use-case';
import { CreateRequestUseCase } from './application/use-cases/create-request.use-case';
import { FindRequesterByEmailUseCase } from './application/use-cases/find-requester-by-email.use-case';
import { GetMostRequestedMaterialsUseCase } from './application/use-cases/get-most-requested-materials.use-case';
import { GetAttentionTimesUseCase } from './application/use-cases/get-attention-times.use-case';
import { ATTENTION_TIME_QUERY } from './application/ports/attention-time-query.port';
import { PrismaAttentionTimeQuery } from './infrastructure/persistence/prisma-attention-time.query';
import { GetRequestDetailUseCase } from './application/use-cases/get-request-detail.use-case';
import { GetRequestHistoryUseCase } from './application/use-cases/get-request-history.use-case';
import { GetRoomCapacityUseCase } from './application/use-cases/get-room-capacity.use-case';
import { GetRoomOccupancyUseCase } from './application/use-cases/get-room-occupancy.use-case';
import { ListAppointmentsUseCase } from './application/use-cases/list-appointments.use-case';
import { ListMyRequestsUseCase } from './application/use-cases/list-my-requests.use-case';
import { ListRequestsUseCase } from './application/use-cases/list-requests.use-case';
import { RescheduleAppointmentUseCase } from './application/use-cases/reschedule-appointment.use-case';
import { ResolveReferenceUseCase } from './application/use-cases/resolve-reference.use-case';
import { ScheduleAppointmentUseCase } from './application/use-cases/schedule-appointment.use-case';
import { UpdateRoomCapacityUseCase } from './application/use-cases/update-room-capacity.use-case';
import { PrismaRequestQueryService } from './infrastructure/persistence/prisma-request-query.service';
import { PrismaRequestRepository } from './infrastructure/persistence/prisma-request.repository';
import { PrismaRequesterRepository } from './infrastructure/persistence/prisma-requester.repository';
import { PrismaRoomCapacityRepository } from './infrastructure/persistence/prisma-room-capacity.repository';
import { PrismaTrackingCodeGenerator } from './infrastructure/persistence/prisma-tracking-code.generator';
import { AppointmentController } from './presentation/controllers/appointment.controller';
import { ReportController } from './presentation/controllers/report.controller';
import { RequestController } from './presentation/controllers/request.controller';
import { RequesterController } from './presentation/controllers/requester.controller';
import { ProfileController } from './presentation/controllers/profile.controller';
import { GetMyProfileUseCase } from './application/use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from './application/use-cases/update-my-profile.use-case';

@Module({
  // USER_REPOSITORY: requester accounts (HU-09, HU-10);
  // MATERIAL_LOAN_REPOSITORY: reading-room delivery (HU-72);
  // MATERIAL_REPOSITORY: the material of a written reference (HU-09.2)
  imports: [UsersModule, MaterialsModule],
  controllers: [
    RequestController,
    RequesterController,
    AppointmentController,
    ProfileController,
    ReportController,
  ],
  providers: [
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    { provide: REQUEST_REPOSITORY, useClass: PrismaRequestRepository },
    { provide: REQUEST_QUERY_SERVICE, useClass: PrismaRequestQueryService },
    { provide: REQUESTER_REPOSITORY, useClass: PrismaRequesterRepository },
    {
      provide: ROOM_CAPACITY_REPOSITORY,
      useClass: PrismaRoomCapacityRepository,
    },
    { provide: TRACKING_CODE_GENERATOR, useClass: PrismaTrackingCodeGenerator },
    RequesterResolver,
    CreateRequestUseCase,
    CreateRequestOnBehalfUseCase,
    FindRequesterByEmailUseCase,
    ListRequestsUseCase,
    ListAppointmentsUseCase,
    GetRoomCapacityUseCase,
    UpdateRoomCapacityUseCase,
    GetRoomOccupancyUseCase,
    GetRequestDetailUseCase,
    GetRequestHistoryUseCase,
    ListMyRequestsUseCase,
    ChangeRequestStatusUseCase,
    ScheduleAppointmentUseCase,
    ResolveReferenceUseCase,
    RescheduleAppointmentUseCase,
    CancelAppointmentUseCase,
    DeliverMaterialUseCase,
    GetMostRequestedMaterialsUseCase,
    GetAttentionTimesUseCase,
    { provide: ATTENTION_TIME_QUERY, useClass: PrismaAttentionTimeQuery },
  ],
})
export class RequestsModule {}
