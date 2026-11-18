import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_STATUS_COMMENT_LENGTH } from './change-request-status.dto';

const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CancelAppointmentDto {
  @ApiPropertyOptional({
    description: 'Motivo u observación opcional de la cancelación (HU-21).',
    example: 'El solicitante pidió cancelar la cita',
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
