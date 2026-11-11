import { Inject, Injectable, Logger } from '@nestjs/common';
import { toAppointmentDay } from '../../domain/appointment-date';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { MaterialNotAvailableError } from '../../domain/errors/material-not-available.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { blocksScheduling } from '../../domain/material-availability';
import { ScheduleAppointmentResponseDto } from '../dto/schedule-appointment-response.dto';
import { buildStatusChangeEmail } from '../notifications/status-change-email';
import type { RequestRepository } from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';

export interface ScheduleAppointmentInput {
  requestId: string;
  // YYYY-MM-DD
  date: string;
  // Who schedules it: always the user of the access token
  userId: string;
}

interface PersonName {
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
}

const fullName = (person: PersonName): string =>
  [person.firstName, person.middleName, person.lastName, person.secondLastName]
    .filter(Boolean)
    .join(' ');

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
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: ScheduleAppointmentInput,
  ): Promise<ScheduleAppointmentResponseDto> {
    // Throws InvalidAppointmentDateError (400) on a Sunday or a wrong date
    const day = toAppointmentDay(input.date);

    const request = await this.repository.findEntityById(input.requestId);
    if (!request) {
      throw new RequestNotFoundError();
    }

    // Throws InvalidStatusTransitionError (409) before anything is saved
    const change = request.scheduleAppointment(input.userId);

    // HU-20: a material being restored or not consultable is not handed
    // over, and one with a cita that day is already committed. EN_USO does
    // not block: it only applies to the day the material is in the room
    // (HU-72). Nothing is saved when either check fails
    const conflicts = await this.repository.findSchedulingConflicts(
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
    const context = await this.repository.findNotificationContext(request.id);
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

    const { statusChange } = saved;
    return {
      id: request.id,
      status: request.status,
      allowedTransitions: request.allowedTransitions,
      appointment: {
        id: saved.id,
        date: saved.date.toISOString().slice(0, 10),
        serviceHours: day.serviceHours,
        status: saved.status,
        requester: { id: saved.requester.id, name: fullName(saved.requester) },
        materials: saved.materials,
      },
      statusChange: {
        previousStatus: statusChange.previousStatus,
        newStatus: statusChange.newStatus,
        changedAt: statusChange.changedAt.toISOString(),
        changedBy: {
          id: statusChange.changedBy.id,
          name: fullName(statusChange.changedBy),
        },
        comment: statusChange.comment,
      },
    };
  }
}
