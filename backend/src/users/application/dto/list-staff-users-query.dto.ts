import {
  DEFAULT_USER_PAGE_LIMIT,
  MAX_USER_PAGE_LIMIT,
} from '../../../common/pagination';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STAFF_ROLES } from '../../domain/enums/user-role';
import type { StaffRole } from '../../domain/enums/user-role';
import { USER_SORT_FIELDS } from '../../domain/repositories/user.repository';
import type {
  SortOrder,
  UserSortField,
} from '../../domain/repositories/user.repository';

// Empty text means "no filter"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

// The query string carries text: only "true" and "false" become booleans
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

/** Query of `GET /api/v1/users/staff` (HU-05). */
export class ListStaffUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Texto a buscar en los nombres o el correo',
    example: 'ana pérez',
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
    description: 'Rol de la cuenta',
    enum: STAFF_ROLES,
  })
  @IsOptional()
  @IsIn(STAFF_ROLES, { message: 'El rol debe ser PERSONAL o ADMIN' })
  role?: StaffRole;

  @ApiPropertyOptional({
    description: 'true: solo cuentas activas; false: solo desactivadas',
    type: Boolean,
  })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser true o false' })
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Campo por el que se ordena',
    enum: USER_SORT_FIELDS,
    default: 'lastName',
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS, {
    message: 'El campo de ordenamiento no es válido',
  })
  sort?: UserSortField;

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
    description: 'Cantidad de cuentas por página',
    minimum: 1,
    maximum: MAX_USER_PAGE_LIMIT,
    default: DEFAULT_USER_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(MAX_USER_PAGE_LIMIT, {
    message: `El límite no puede superar ${MAX_USER_PAGE_LIMIT}`,
  })
  limit?: number;
}
