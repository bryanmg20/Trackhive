import type { Request } from '../../domain/entities/request.entity';
import type { SavedCancelledAppointment } from '../../domain/value-objects/saved-appointment';
import { CancelAppointmentResponseDto } from '../dto/cancel-appointment-response.dto';
import { DateOnlyMapper } from './date-only.mapper';
import { StatusChangeResponseMapper } from './status-change-response.mapper';

/** The request and appointment after «Cancelar cita» (HU-21) → its response. */
export class CancelAppointmentResponseMapper {
  static toDto(
    request: Request,
    saved: SavedCancelledAppointment,
  ): CancelAppointmentResponseDto {
    return {
      id: request.id,
      status: request.status,
      allowedTransitions: request.allowedTransitions,
      appointment: {
        id: saved.id,
        date: DateOnlyMapper.toDto(saved.date),
        status: saved.status,
      },
      statusChange: StatusChangeResponseMapper.toDto(saved.statusChange),
    };
  }
}
