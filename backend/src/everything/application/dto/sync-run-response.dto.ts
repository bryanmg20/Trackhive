import { ApiProperty } from '@nestjs/swagger';
import { SYNC_RUN_STATUSES } from '../../domain/enums/sync-run-status';
import type { SyncRunStatus } from '../../domain/enums/sync-run-status';

export class SyncRunResponseDto {
  @ApiProperty({
    description: 'Identificador de la corrida',
    format: 'uuid',
    example: '0b6a8f1e-3c2d-4e5f-9a8b-7c6d5e4f3a2b',
  })
  id: string;

  @ApiProperty({
    description:
      'EN_CURSO mientras el agente envía páginas; OK si se cerró completa; ' +
      'ERROR si se cerró con error, no estaba completa o venció',
    enum: SYNC_RUN_STATUSES,
  })
  status: SyncRunStatus;

  @ApiProperty({
    description: 'Inicio de la corrida (ISO 8601, UTC)',
    example: '2026-11-23T11:00:00.000Z',
  })
  startedAt: string;

  @ApiProperty({
    description: 'Última actividad: el inicio o la última página recibida',
    example: '2026-11-23T11:00:04.000Z',
  })
  lastActivityAt: string;

  @ApiProperty({
    description: 'Fin de la corrida; null mientras está EN_CURSO',
    nullable: true,
    type: String,
  })
  finishedAt: string | null;

  @ApiProperty({
    description: 'Resultados que devolvió Everything en las páginas recibidas',
    example: 130,
  })
  filesCount: number;

  @ApiProperty({
    description: 'Motivo del error; solo cuando el estado es ERROR',
    nullable: true,
    type: String,
  })
  errorMessage: string | null;
}

export class SyncRunSummaryDto {
  @ApiProperty({
    description:
      'Carpetas hoja bajo las raíces de los fondos: un material cada una',
    example: 115,
  })
  leaves: number;

  @ApiProperty({ description: 'Materiales creados', example: 3 })
  created: number;

  @ApiProperty({
    description: 'Materiales que ya existían (por su código) y se actualizaron',
    example: 112,
  })
  updated: number;

  @ApiProperty({
    description:
      'Materiales de Everything que la corrida no vio: quedaron como «copia digital no encontrada». Ninguno se borra',
    example: 1,
  })
  notFound: number;

  @ApiProperty({
    description:
      'Hojas sin código válido o con un código repetido: quedaron para revisión',
    example: 9,
  })
  forReview: number;
}

export class ClosedSyncRunResponseDto extends SyncRunResponseDto {
  @ApiProperty({
    description:
      'Qué hizo con el catálogo; null si la corrida terminó con error',
    type: SyncRunSummaryDto,
    nullable: true,
  })
  summary: SyncRunSummaryDto | null;
}
