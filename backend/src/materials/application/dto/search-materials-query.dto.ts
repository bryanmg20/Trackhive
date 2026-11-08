import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MATERIAL_STATUSES } from '../../domain/material-status';
import type { MaterialStatus } from '../../domain/material-status';
import { MATERIAL_TYPES } from '../../domain/material-type';
import type { MaterialType } from '../../domain/material-type';
import { MATERIAL_SORT_FIELDS } from '../../domain/repositories/material.repository';
import type {
  MaterialSortField,
  SortOrder,
} from '../../domain/repositories/material.repository';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

// Empty text means "no filter"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class SearchMaterialsQueryDto {
  @ApiPropertyOptional({
    description: 'Texto a buscar en título, autor, código o colección',
    example: 'cabildo',
    maxLength: 100,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'El texto de búsqueda debe ser texto' })
  @MaxLength(100, {
    message: 'El texto de búsqueda no puede superar los 100 caracteres',
  })
  q?: string;

  @ApiPropertyOptional({
    description: 'Tipo de material',
    enum: MATERIAL_TYPES,
  })
  @IsOptional()
  @IsIn(MATERIAL_TYPES, { message: 'El tipo de material no es válido' })
  type?: MaterialType;

  @ApiPropertyOptional({
    description: 'Colección o tema (coincidencia exacta)',
    example: 'Actas del Cabildo',
    maxLength: 120,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'La colección debe ser texto' })
  @MaxLength(120, {
    message: 'La colección no puede superar los 120 caracteres',
  })
  collection?: string;

  @ApiPropertyOptional({
    description: 'Estado del material',
    enum: MATERIAL_STATUSES,
  })
  @IsOptional()
  @IsIn(MATERIAL_STATUSES, { message: 'El estado del material no es válido' })
  status?: MaterialStatus;

  @ApiPropertyOptional({
    description: 'Campo por el que se ordena',
    enum: MATERIAL_SORT_FIELDS,
    default: 'title',
  })
  @IsOptional()
  @IsIn(MATERIAL_SORT_FIELDS, {
    message: 'El campo de ordenamiento no es válido',
  })
  sort?: MaterialSortField;

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'La dirección del ordenamiento debe ser asc o desc',
  })
  order?: SortOrder;

  @ApiPropertyOptional({
    description: 'Número de página, desde 1',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de materiales por página',
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
    default: DEFAULT_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(MAX_PAGE_LIMIT, {
    message: `El límite no puede superar ${MAX_PAGE_LIMIT}`,
  })
  limit?: number;
}
