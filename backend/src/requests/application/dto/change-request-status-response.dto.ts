import { ApiProperty } from '@nestjs/swagger';
import { REQUEST_STATUSES } from '../../domain/request-status';
import type { RequestStatus } from '../../domain/request-status';

export class StatusChangeUserDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Ana María Gómez' })
  name: string;
}

export class StatusChangeDto {
  @ApiProperty({ enum: REQUEST_STATUSES, example: 'AGENDADA' })
  previousStatus: RequestStatus;

  @ApiProperty({ enum: REQUEST_STATUSES, example: 'ATENDIDA' })
  newStatus: RequestStatus;

  @ApiProperty({
    description: 'Fecha y hora del cambio (ISO 8601, UTC)',
    example: '2026-11-10T15:00:00.000Z',
  })
  changedAt: string;

  @ApiProperty({
    type: StatusChangeUserDto,
    description: 'Responsable del cambio',
  })
  changedBy: StatusChangeUserDto;

  @ApiProperty({ nullable: true, type: String })
  comment: string | null;
}

export class ChangeRequestStatusResponseDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ enum: REQUEST_STATUSES, example: 'ATENDIDA' })
  status: RequestStatus;

  @ApiProperty({
    description: 'Estados a los que puede pasar desde el nuevo estado (HU-14)',
    enum: REQUEST_STATUSES,
    isArray: true,
    example: ['CERRADA'],
  })
  allowedTransitions: RequestStatus[];

  @ApiProperty({
    type: StatusChangeDto,
    description: 'Registro guardado en el historial de estados',
  })
  statusChange: StatusChangeDto;
}
