import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { REQUEST_STATUSES } from '../../domain/request-status';
import type { RequestStatus } from '../../domain/request-status';
import { REQUEST_SORT_FIELDS } from '../ports/request.repository.port';
import type {
  RequestSortField,
  SortOrder,
} from '../ports/request.repository.port';

export const DEFAULT_REQUEST_PAGE_LIMIT = 20;
export const MAX_REQUEST_PAGE_LIMIT = 100;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Empty text means "no filter"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ListRequestsQueryDto {
  @ApiPropertyOptional({
    description: 'Estado de la solicitud',
    enum: REQUEST_STATUSES,
  })
  @IsOptional()
  @IsIn(REQUEST_STATUSES, { message: 'El estado no es válido' })
  status?: RequestStatus;

  @ApiPropertyOptional({
    description: 'Fecha deseada desde (incluida), formato YYYY-MM-DD',
    example: '2026-12-01',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha no es válida' })
  desiredFrom?: string;

  @ApiPropertyOptional({
    description: 'Fecha deseada hasta (incluida), formato YYYY-MM-DD',
    example: '2026-12-31',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha no es válida' })
  desiredTo?: string;

  @ApiPropertyOptional({
    description:
      'Texto a buscar en los nombres, el correo o el documento del solicitante',
    example: 'juan pérez',
    maxLength: 100,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'El solicitante debe ser texto' })
  @MaxLength(100, {
    message: 'El solicitante no puede superar los 100 caracteres',
  })
  requester?: string;

  @ApiPropertyOptional({
    description:
      'Texto a buscar en el título o el código de un material de la solicitud',
    example: 'cabildo',
    maxLength: 100,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'El material debe ser texto' })
  @MaxLength(100, {
    message: 'El material no puede superar los 100 caracteres',
  })
  material?: string;

  @ApiPropertyOptional({
    description: 'Campo por el que se ordena',
    enum: REQUEST_SORT_FIELDS,
    default: 'registeredAt',
  })
  @IsOptional()
  @IsIn(REQUEST_SORT_FIELDS, {
    message: 'El campo de ordenamiento no es válido',
  })
  sort?: RequestSortField;

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: ['asc', 'desc'],
    default: 'desc',
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
    description: 'Cantidad de solicitudes por página',
    minimum: 1,
    maximum: MAX_REQUEST_PAGE_LIMIT,
    default: DEFAULT_REQUEST_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(MAX_REQUEST_PAGE_LIMIT, {
    message: `El límite no puede superar ${MAX_REQUEST_PAGE_LIMIT}`,
  })
  limit?: number;
}
