import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MATERIAL_REFERENCE_KINDS } from '../../domain/enums/material-reference-kind';
import type { MaterialReferenceKind } from '../../domain/enums/material-reference-kind';
import {
  REFERENCE_DEED_NUMBER_MAX_LENGTH,
  REFERENCE_DESCRIPTION_MAX_LENGTH,
  REFERENCE_DESCRIPTION_MIN_LENGTH,
  REFERENCE_MIN_YEAR,
  REFERENCE_NOTARY_MAX_LENGTH,
} from '../../domain/value-objects/material-reference';

const trimText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const isNotarial = (reference: MaterialReferenceDto): boolean =>
  reference.kind === 'PROTOCOLO_NOTARIAL';

/**
 * A material that is not in the catalog, described in writing (HU-09.2). The
 * entity checks again the year against the current one (RN-04).
 */
export class MaterialReferenceDto {
  @ApiProperty({
    description:
      'PROTOCOLO_NOTARIAL: notaría, año y número de escritura. TEXTO_LIBRE: cualquier otro material, descrito en texto.',
    enum: MATERIAL_REFERENCE_KINDS,
    example: 'TEXTO_LIBRE',
  })
  @IsIn(MATERIAL_REFERENCE_KINDS, {
    message: 'El tipo de referencia no es válido',
  })
  kind: MaterialReferenceKind;

  @ApiPropertyOptional({
    description: 'Notaría; obligatoria para PROTOCOLO_NOTARIAL',
    example: 'Notaría Primera de Barranquilla',
    maxLength: REFERENCE_NOTARY_MAX_LENGTH,
  })
  @ValidateIf(isNotarial)
  @Transform(trimText)
  @IsString({ message: 'La notaría debe ser texto' })
  @IsNotEmpty({ message: 'La notaría es obligatoria' })
  @MaxLength(REFERENCE_NOTARY_MAX_LENGTH, {
    message: `La notaría no puede superar los ${REFERENCE_NOTARY_MAX_LENGTH} caracteres`,
  })
  notary?: string;

  @ApiPropertyOptional({
    description: 'Año de la escritura; obligatorio para PROTOCOLO_NOTARIAL',
    example: 1950,
    minimum: REFERENCE_MIN_YEAR,
  })
  @ValidateIf(isNotarial)
  @Type(() => Number)
  @IsInt({ message: 'El año de la escritura debe ser un número entero' })
  @Min(REFERENCE_MIN_YEAR, {
    message: `El año de la escritura debe ser ${REFERENCE_MIN_YEAR} o posterior`,
  })
  year?: number;

  @ApiPropertyOptional({
    description: 'Número de escritura; obligatorio para PROTOCOLO_NOTARIAL',
    example: '245',
    maxLength: REFERENCE_DEED_NUMBER_MAX_LENGTH,
  })
  @ValidateIf(isNotarial)
  @Transform(trimText)
  @IsString({ message: 'El número de escritura debe ser texto' })
  @IsNotEmpty({ message: 'El número de escritura es obligatorio' })
  @MaxLength(REFERENCE_DEED_NUMBER_MAX_LENGTH, {
    message: `El número de escritura no puede superar los ${REFERENCE_DEED_NUMBER_MAX_LENGTH} caracteres`,
  })
  deedNumber?: string;

  @ApiPropertyOptional({
    description: 'Descripción del material; obligatoria para TEXTO_LIBRE',
    example: 'El Heraldo, 15-03-1950',
    minLength: REFERENCE_DESCRIPTION_MIN_LENGTH,
    maxLength: REFERENCE_DESCRIPTION_MAX_LENGTH,
  })
  @ValidateIf((reference: MaterialReferenceDto) => !isNotarial(reference))
  @Transform(trimText)
  @IsString({ message: 'La descripción debe ser texto' })
  @MinLength(REFERENCE_DESCRIPTION_MIN_LENGTH, {
    message: `La descripción debe tener al menos ${REFERENCE_DESCRIPTION_MIN_LENGTH} caracteres`,
  })
  @MaxLength(REFERENCE_DESCRIPTION_MAX_LENGTH, {
    message: `La descripción no puede superar los ${REFERENCE_DESCRIPTION_MAX_LENGTH} caracteres`,
  })
  description?: string;
}
