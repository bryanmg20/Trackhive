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
import { APPOINTMENT_STATUSES } from '../../domain/appointment-status';
import type { AppointmentStatus } from '../../domain/appointment-status';
import { APPOINTMENT_SORT_FIELDS } from '../ports/request.repository.port';
import type {
  AppointmentSortField,
  SortOrder,
} from '../ports/request.repository.port';

export const DEFAULT_APPOINTMENT_PAGE_LIMIT = 20;
export const MAX_APPOINTMENT_PAGE_LIMIT = 100;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Empty text means "no filter"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ListAppointmentsQueryDto {
  @ApiPropertyOptional({
    description: 'Estado de la cita',
    enum: APPOINTMENT_STATUSES,
  })
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES, { message: 'El estado de la cita no es válido' })
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Fecha de la cita desde (incluida), formato YYYY-MM-DD',
    example: '2026-11-01',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha no es válida' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Fecha de la cita hasta (incluida), formato YYYY-MM-DD',
    example: '2026-12-31',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha no es válida' })
  to?: string;

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
      'Texto a buscar en el título o el código de un material de la cita',
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
    enum: APPOINTMENT_SORT_FIELDS,
    default: 'appointmentDate',
  })
  @IsOptional()
  @IsIn(APPOINTMENT_SORT_FIELDS, {
    message: 'El campo de ordenamiento no es válido',
  })
  sort?: AppointmentSortField;

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
    description: 'Cantidad de citas por página',
    minimum: 1,
    maximum: MAX_APPOINTMENT_PAGE_LIMIT,
    default: DEFAULT_APPOINTMENT_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(MAX_APPOINTMENT_PAGE_LIMIT, {
    message: `El límite no puede superar ${MAX_APPOINTMENT_PAGE_LIMIT}`,
  })
  limit?: number;
}
