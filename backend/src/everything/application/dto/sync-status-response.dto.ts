import { ApiProperty } from '@nestjs/swagger';
import { SyncRunResponseDto } from './sync-run-response.dto';

export class CurrentSyncRunResponseDto extends SyncRunResponseDto {
  @ApiProperty({
    description:
      'true si la corrida está EN_CURSO pero lleva más de ' +
      'EVERYTHING_RUN_TIMEOUT_MINUTES sin recibir páginas (el agente se cerró o ' +
      'perdió la conexión): pedir otra sincronización la cierra con error, sin ' +
      'marcar nada como no encontrado. Una corrida PEDIDA nunca vence',
    example: false,
  })
  expired: boolean;
}

/** What the screen «Sincronización con Everything» shows (HU-138). */
export class SyncStatusResponseDto {
  @ApiProperty({
    description:
      'false si el servidor no tiene EVERYTHING_AGENT_TOKEN: la integración ' +
      'está desactivada y no se puede pedir una sincronización',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description:
      'La corrida PEDIDA (espera al agente) o EN_CURSO; null si no hay ninguna. ' +
      'Nunca hay más de una',
    type: CurrentSyncRunResponseDto,
    nullable: true,
  })
  currentRun: CurrentSyncRunResponseDto | null;

  @ApiProperty({
    description:
      'La última corrida que terminó, OK o ERROR, con sus carpetas recibidas ' +
      '(filesCount) y el motivo si terminó con error; null si todavía no hay ' +
      'ninguna',
    type: SyncRunResponseDto,
    nullable: true,
  })
  lastRun: SyncRunResponseDto | null;

  @ApiProperty({
    description:
      'Última vez que el agente del CLENA llamó a Trackhive con su token ' +
      '(ISO 8601, UTC); null si nunca lo ha hecho',
    nullable: true,
    type: String,
    example: '2026-11-23T11:05:00.000Z',
  })
  agentLastContactAt: string | null;
}
