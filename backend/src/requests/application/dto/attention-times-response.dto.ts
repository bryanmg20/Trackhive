import { ApiProperty } from '@nestjs/swagger';
import { ATTENTION_TIME_STATES } from '../../domain/policies/attention-times';
import type { AttentionTimeState } from '../../domain/policies/attention-times';

export class StateAttentionTimeDto {
  @ApiProperty({ enum: ATTENTION_TIME_STATES })
  state: AttentionTimeState;

  @ApiProperty({
    description:
      'Solicitudes atendidas que recorrieron este estado antes de Atendida',
    example: 3,
  })
  requestCount: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Segundos transcurridos promedio; suma las permanencias repetidas de cada solicitud. Null sin observaciones.',
    example: 7200,
  })
  averageSeconds: number | null;
}

export class AttentionTimesResponseDto {
  @ApiProperty({ type: String, nullable: true, example: '2026-11-01' })
  from: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-11-30' })
  to: string | null;

  @ApiProperty({
    description:
      'Solicitudes radicadas en el rango que alcanzaron Atendida; incluye las luego cerradas',
    example: 5,
  })
  completedRequests: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Promedio de segundos entre la radicación y la primera entrada a Atendida del historial; usa attended_at si un dato antiguo carece de esa entrada. Null sin solicitudes atendidas.',
    example: 86400,
  })
  averageSeconds: number | null;

  @ApiProperty({ type: StateAttentionTimeDto, isArray: true })
  states: StateAttentionTimeDto[];
}
