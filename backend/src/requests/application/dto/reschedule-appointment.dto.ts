import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MAX_STATUS_COMMENT_LENGTH } from './change-request-status.dto';

const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class RescheduleAppointmentDto {
  @ApiProperty({
    description:
      'Nuevo día de la cita (YYYY-MM-DD), sin hora: lunes a viernes ' +
      '8:00-17:00, sábados 9:00-13:00. No se aceptan domingos (HU-21).',
    example: '2026-11-23',
  })
  @IsString({ message: 'La fecha de la cita debe ser texto' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de la cita debe tener el formato YYYY-MM-DD',
  })
  date: string;

  @ApiPropertyOptional({
    description: 'Motivo u observación opcional de la reprogramación (HU-21).',
    example: 'Se reprogramó por cambio de último momento del solicitante',
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
