import type { Request } from '../../domain/entities/request.entity';
import type { ServiceHours } from '../../domain/value-objects/appointment-date';
import type { SavedAppointment } from '../../domain/value-objects/saved-appointment';
import { ScheduleAppointmentResponseDto } from '../dto/schedule-appointment-response.dto';
import { DateOnlyMapper } from './date-only.mapper';
import { PersonNameMapper } from './person-name.mapper';
import { StatusChangeResponseMapper } from './status-change-response.mapper';

/** The request after «Agendar cita» (HU-18) → its response. */
export class ScheduleAppointmentResponseMapper {
  static toDto(
    request: Request,
    saved: SavedAppointment,
    serviceHours: ServiceHours,
  ): ScheduleAppointmentResponseDto {
    return {
      id: request.id,
      status: request.status,
      allowedTransitions: request.allowedTransitions,
      appointment: {
        id: saved.id,
        date: DateOnlyMapper.toDto(saved.date),
        serviceHours,
        status: saved.status,
        requester: {
          id: saved.requester.id,
          name: PersonNameMapper.fullName(saved.requester),
        },
        materials: saved.materials,
      },
      statusChange: StatusChangeResponseMapper.toDto(saved.statusChange),
    };
  }
}
