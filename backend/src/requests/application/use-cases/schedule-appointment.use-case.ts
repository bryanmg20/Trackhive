import { Inject, Injectable } from '@nestjs/common';
import { toAppointmentDay } from '../../domain/appointment-date';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { ScheduleAppointmentResponseDto } from '../dto/schedule-appointment-response.dto';
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
 * only lets a presential DISPONIBLE request reach AGENDADA (HU-14).
 */
@Injectable()
export class ScheduleAppointmentUseCase {
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
    const saved = await this.repository.saveAppointment(change, day.date);

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
