import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MATERIAL_STATUSES } from '../../domain/material-status';
import type { MaterialStatus } from '../../domain/material-status';

export const MAX_STATUS_REASON_LENGTH = 500;

// Empty text means "no reason"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ChangeMaterialStatusDto {
  @ApiProperty({
    description: 'Nuevo estado del material',
    enum: MATERIAL_STATUSES,
    example: 'EN_RESTAURACION',
  })
  @IsIn(MATERIAL_STATUSES, {
    message: `El estado debe ser uno de: ${MATERIAL_STATUSES.join(', ')}`,
  })
  status: MaterialStatus;

  @ApiPropertyOptional({
    description: 'Motivo del cambio (opcional)',
    example: 'Humedad en la caja',
    maxLength: MAX_STATUS_REASON_LENGTH,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(MAX_STATUS_REASON_LENGTH, {
    message: `El motivo no puede superar los ${MAX_STATUS_REASON_LENGTH} caracteres`,
  })
  reason?: string;
}
