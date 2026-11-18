import { ApiProperty } from '@nestjs/swagger';
import { REQUEST_STATUSES } from '../../domain/enums/request-status';
import type { RequestStatus } from '../../domain/enums/request-status';
import { StatusChangeDto } from './change-request-status-response.dto';

export class CancelledAppointmentDto {
  @ApiProperty({ example: '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({
    description: 'Día que tenía asignada la cita cancelada (YYYY-MM-DD)',
    example: '2026-11-20',
  })
  date: string;

  @ApiProperty({ enum: ['CANCELADA'], example: 'CANCELADA' })
  status: 'CANCELADA';
}

export class CancelAppointmentResponseDto {
  @ApiProperty({
    description: 'Identificador de la solicitud',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({ enum: REQUEST_STATUSES, example: 'DISPONIBLE' })
  status: RequestStatus;

  @ApiProperty({
    description: 'Estados a los que puede pasar desde DISPONIBLE (HU-14)',
    enum: REQUEST_STATUSES,
    isArray: true,
    example: ['AGENDADA', 'CERRADA'],
  })
  allowedTransitions: RequestStatus[];

  @ApiProperty({ type: CancelledAppointmentDto })
  appointment: CancelledAppointmentDto;

  @ApiProperty({
    type: StatusChangeDto,
    description: 'Registro del regreso a DISPONIBLE en el historial de estados',
  })
  statusChange: StatusChangeDto;
}
