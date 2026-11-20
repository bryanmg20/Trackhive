import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_LOAN_NOTES_LENGTH = 500;

const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ReturnMaterialDto {
  @ApiPropertyOptional({
    description: 'Observaciones opcionales al recibir la devolución',
    example: 'Devuelto completo y en buen estado',
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
