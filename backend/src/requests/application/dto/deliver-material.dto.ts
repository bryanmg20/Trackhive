import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_LOAN_NOTES_LENGTH } from '../../../materials/application/dto/return-material.dto';

const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class DeliverMaterialDto {
  @ApiPropertyOptional({
    description: 'Observaciones opcionales al entregar el material',
    example: 'Entregado en sala de consulta',
    maxLength: MAX_LOAN_NOTES_LENGTH,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser texto' })
  @MaxLength(MAX_LOAN_NOTES_LENGTH, {
    message: `Las observaciones no pueden superar los ${MAX_LOAN_NOTES_LENGTH} caracteres`,
  })
  notes?: string;
}
