import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MANUAL_MATERIAL_STATUSES } from '../../domain/enums/material-status';
import type { ManualMaterialStatus } from '../../domain/enums/material-status';

export const MAX_STATUS_REASON_LENGTH = 500;

// Empty text means "no reason"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ChangeMaterialStatusDto {
  @ApiProperty({
    description:
      'Nuevo estado manual del material (EN_USO solo cambia mediante entrega y devolución)',
    enum: MANUAL_MATERIAL_STATUSES,
    example: 'EN_RESTAURACION',
  })
  @IsIn(MANUAL_MATERIAL_STATUSES, {
    message: `El estado manual debe ser uno de: ${MANUAL_MATERIAL_STATUSES.join(', ')}`,
  })
  status: ManualMaterialStatus;

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
