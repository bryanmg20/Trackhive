import { ApiProperty } from '@nestjs/swagger';

/** Whether an administrator asked for «Sincronizar ahora» (HU-138). */
export class RequestedSyncRunResponseDto {
  @ApiProperty({
    description:
      'true si hay una corrida PEDIDA: el agente debe sincronizar, y al iniciar ' +
      'la corrida (POST /everything/sync-runs) la toma',
    example: true,
  })
  requested: boolean;

  @ApiProperty({
    description: 'Cuándo se pidió (ISO 8601, UTC); null si no hay ninguna',
    nullable: true,
    type: String,
    example: '2026-11-23T10:58:00.000Z',
  })
  requestedAt: string | null;
}
