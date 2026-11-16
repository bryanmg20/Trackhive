import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { ScheduleAppointmentInput } from '../dto/schedule-appointment.input';
import { toAppointmentDay } from '../../domain/value-objects/appointment-date';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { MaterialNotAvailableError } from '../../domain/errors/material-not-available.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { blocksScheduling } from '../../domain/policies/material-availability';
import { ScheduleAppointmentResponseDto } from '../dto/schedule-appointment-response.dto';
import { buildStatusChangeEmail } from '../services/status-change-email';
import { ScheduleAppointmentResponseMapper } from '../mappers/schedule-appointment-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE, REQUEST_REPOSITORY } from '../tokens';

/**
 * «Agendar cita de consulta» (HU-18). The appointment is a whole day, without
 * a time, for the requester and every material of the request. The entity
 * only lets a presential DISPONIBLE request reach AGENDADA (HU-14). A
 * material that is EN_RESTAURACION or NO_CONSULTABLE, or that already has a
 * cita that day, is refused before anything is saved (HU-20). The email to
 * the requester is queued in the same transaction (HU-23).
 */
@Injectable()
export class ScheduleAppointmentUseCase {
  private readonly logger = new Logger(ScheduleAppointmentUseCase.name);

  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: IRequestRepository,
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: ScheduleAppointmentInput,
  ): Promise<ScheduleAppointmentResponseDto> {
    // Throws InvalidAppointmentDateError (400) on a Sunday or a wrong date
    const day = toAppointmentDay(input.date);

    const request = await this.repository.findById(input.requestId);
    if (!request) {
      throw new RequestNotFoundError();
    }

    // Throws InvalidStatusTransitionError (409) before anything is saved
    const change = request.scheduleAppointment(input.userId);

    // HU-20: a material being restored or not consultable is not handed
    // over, and one with a cita that day is already committed. EN_USO does
    // not block: it only applies to the day the material is in the room
    // (HU-72). Nothing is saved when either check fails
    const conflicts = await this.queries.findSchedulingConflicts(
      request.id,
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

    // HU-23: the requester learns the day and the service hours by email
    const context = await this.queries.findNotificationContext(request.id);
    const notification = context
      ? buildStatusChangeEmail(context, {
          newStatus: change.newStatus,
          appointment: { date: day.date, serviceHours: day.serviceHours },
        })
      : null;
    if (!notification) {
      this.logger.warn(
        `Request ${context?.trackingCode ?? request.id} has no requester ` +
          'email: its appointment is saved without an email',
      );
    }

    const saved = await this.repository.saveAppointment(
      change,
      day.date,
      notification,
    );

    return ScheduleAppointmentResponseMapper.toDto(
      request,
      saved,
      day.serviceHours,
    );
  }
}
