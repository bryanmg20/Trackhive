import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { AppointmentNotScheduledError } from '../../domain/errors/appointment-not-scheduled.error';
import { InvalidAppointmentDateError } from '../../domain/errors/invalid-appointment-date.error';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { MaterialNotAvailableError } from '../../domain/errors/material-not-available.error';
import { RoomCapacityExceededError } from '../../domain/errors/room-capacity-exceeded.error';
import { blocksScheduling } from '../../domain/policies/material-availability';
import { isRoomFull } from '../../domain/policies/room-capacity';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { IRoomCapacityRepository } from '../../domain/repositories/room-capacity.repository';
import { toAppointmentDay } from '../../domain/value-objects/appointment-date';
import type { RescheduleAppointmentInput } from '../dto/reschedule-appointment.input';
import { ScheduleAppointmentResponseDto } from '../dto/schedule-appointment-response.dto';
import { DateOnlyMapper } from '../mappers/date-only.mapper';
import { ScheduleAppointmentResponseMapper } from '../mappers/schedule-appointment-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { buildStatusChangeEmail } from '../services/status-change-email';
import {
  REQUEST_QUERY_SERVICE,
  REQUEST_REPOSITORY,
  ROOM_CAPACITY_REPOSITORY,
} from '../tokens';

/**
 * «Reprogramar cita» (HU-21). Moves a PROGRAMADA appointment to another day,
 * re-validating material availability (HU-20) and daily room capacity
 * (HU-20.1), recording the change in status_history and queuing the email to
 * the requester in the same transaction.
 */
@Injectable()
export class RescheduleAppointmentUseCase {
  private readonly logger = new Logger(RescheduleAppointmentUseCase.name);

  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: IRequestRepository,
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
    @Inject(ROOM_CAPACITY_REPOSITORY)
    private readonly roomCapacity: IRoomCapacityRepository,
  ) {}

  async execute(
    input: RescheduleAppointmentInput,
  ): Promise<ScheduleAppointmentResponseDto> {
    const day = toAppointmentDay(input.date);

    const appointment = await this.repository.findAppointmentById(
      input.appointmentId,
    );
    if (!appointment) {
      throw new AppointmentNotFoundError();
    }
    if (appointment.status !== 'PROGRAMADA') {
      throw new AppointmentNotScheduledError();
    }
    if (appointment.date.getTime() === day.date.getTime()) {
      throw new InvalidAppointmentDateError(
        'La nueva fecha de la cita debe ser distinta a la fecha actual.',
      );
    }

    const previousDate = DateOnlyMapper.toDto(appointment.date);
    const defaultComment = `Cita reprogramada del ${previousDate} al ${input.date}`;
    const comment = input.comment?.trim() || defaultComment;
    const change = appointment.request.rescheduleAppointment(
      input.userId,
      comment,
    );

    const conflicts = await this.queries.findSchedulingConflicts(
      appointment.request.id,
      day.date,
    );
    const unavailable = conflicts.materials.filter((material) =>
      blocksScheduling(material.status),
    );
    if (unavailable.length > 0) {
      throw new MaterialNotAvailableError(unavailable);
    }
    if (conflicts.bookedMaterials.length > 0) {
      throw new MaterialAlreadyBookedError(conflicts.bookedMaterials);
    }

    const [capacityConfig, occupiedSlots] = await Promise.all([
      this.roomCapacity.getConfig(),
      this.queries.countActiveAppointmentsOnDate(day.date),
    ]);
    if (isRoomFull(occupiedSlots, capacityConfig.dailyCapacity)) {
      throw new RoomCapacityExceededError(
        day.date,
        capacityConfig.dailyCapacity,
      );
    }

    const context = await this.queries.findNotificationContext(
      appointment.request.id,
    );
    const notification = context
      ? buildStatusChangeEmail(context, {
          newStatus: change.newStatus,
          appointment: { date: day.date, serviceHours: day.serviceHours },
        })
      : null;
    if (!notification) {
      this.logger.warn(
        `Request ${context?.trackingCode ?? appointment.request.id} has no ` +
          'requester email: its rescheduled appointment is saved without an email',
      );
    }

    const saved = await this.repository.rescheduleAppointment(
      appointment.id,
      change,
      day.date,
      notification,
    );

    return ScheduleAppointmentResponseMapper.toDto(
      appointment.request,
      saved,
      day.serviceHours,
    );
  }
}
