import { Inject, Injectable, Logger } from '@nestjs/common';
import { toAppointmentDay } from '../../domain/appointment-date';
import { MaterialUnavailableError } from '../../domain/errors/material-unavailable.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { findMaterialConflicts } from '../../domain/material-availability';
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
 * material cannot be booked twice on the same day, nor scheduled while in
 * restoration or not consultable (HU-20). The email to the requester is
 * queued in the same transaction (HU-23).
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

    // HU-20: no material booked that day by another request, nor in
    // restoration or not consultable. EN_USO does not block (HU-72)
    const conflicts = findMaterialConflicts(
      await this.repository.findMaterialAvailability(request.id, day.date),
    );
    if (conflicts.length > 0) {
      throw MaterialUnavailableError.forConflicts(conflicts, day.date);
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
