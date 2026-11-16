import { ApiProperty } from '@nestjs/swagger';
import { REQUEST_STATUSES } from '../../domain/enums/request-status';
import type { RequestStatus } from '../../domain/enums/request-status';

export class RequestHistoryEntryDto {
  @ApiProperty({ example: '42' })
  id: string;

  @ApiProperty({
    description: 'Estado anterior; vacío en el registro de la solicitud',
    enum: REQUEST_STATUSES,
    nullable: true,
  })
  previousStatus: RequestStatus | null;

  @ApiProperty({ enum: REQUEST_STATUSES, example: 'EN_BUSQUEDA' })
  newStatus: RequestStatus;

  @ApiProperty({ example: '2026-11-10T15:00:00.000Z' })
  changedAt: string;

  @ApiProperty({
    description:
      'Quién hizo el cambio. El personal ve el nombre completo; el ' +
      'solicitante ve su propio nombre o «Personal del CLENA».',
    example: 'Ana María Gómez',
  })
  changedBy: string;

  @ApiProperty({
    description: 'Observación del cambio; en RECHAZADA es el motivo',
    nullable: true,
    type: String,
  })
  comment: string | null;
}

export class RequestHistoryResponseDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  requestId: string;

  @ApiProperty({ example: 'SOL-2026-00001' })
  trackingCode: string;

  @ApiProperty({
    description: 'Cambios de estado, del más antiguo al más reciente',
    type: [RequestHistoryEntryDto],
  })
  entries: RequestHistoryEntryDto[];
}
