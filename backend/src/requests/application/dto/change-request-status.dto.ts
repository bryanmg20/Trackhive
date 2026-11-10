import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CHANGEABLE_STATUSES } from '../../domain/request-status';
import type { ChangeableStatus } from '../../domain/request-status';

export const MAX_STATUS_COMMENT_LENGTH = 500;

// Empty text means "no comment"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ChangeRequestStatusDto {
  @ApiProperty({
    description:
      'Nuevo estado. Solo se aceptan las transiciones válidas desde el ' +
      'estado actual (HU-14). Desde AGENDADA, ATENDIDA significa que el ' +
      'solicitante asistió y DISPONIBLE que no asistió. RECHAZADA exige ' +
      'el comentario, que es el motivo del rechazo (HU-16).',
    enum: CHANGEABLE_STATUSES,
    example: 'ATENDIDA',
  })
  @IsIn(CHANGEABLE_STATUSES, {
    message: `El estado debe ser uno de: ${CHANGEABLE_STATUSES.join(', ')}`,
  })
  status: ChangeableStatus;

  @ApiPropertyOptional({
    description:
      'Comentario del cambio. Opcional, salvo al rechazar: con RECHAZADA es ' +
      'el motivo que verá el solicitante y, si falta o está en blanco, la ' +
      'API responde 400 REJECTION_REASON_REQUIRED (HU-16).',
    example: 'El investigador consultó las actas en la sala',
    maxLength: MAX_STATUS_COMMENT_LENGTH,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'El comentario debe ser texto' })
  @MaxLength(MAX_STATUS_COMMENT_LENGTH, {
    message: `El comentario no puede superar los ${MAX_STATUS_COMMENT_LENGTH} caracteres`,
  })
  comment?: string;
}
