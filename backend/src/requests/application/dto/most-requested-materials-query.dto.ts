import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_REPORT_RANKING_LIMIT,
  MAX_REPORT_RANKING_LIMIT,
} from '../../../common/pagination';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Empty text means "no filter"
const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** The filters of «Material más solicitado» (HU-26). */
export class MostRequestedMaterialsQueryDto {
  @ApiPropertyOptional({
    description:
      'Fecha de registro desde (incluida, hora de Bogotá), formato YYYY-MM-DD',
    example: '2026-11-01',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha inicial no es válida' })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Fecha de registro hasta (incluida, hora de Bogotá), formato YYYY-MM-DD',
    example: '2026-11-30',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha final no es válida' })
  to?: string;

  @ApiPropertyOptional({
    description: 'Cantidad de materiales del ranking',
    minimum: 1,
    maximum: MAX_REPORT_RANKING_LIMIT,
    default: DEFAULT_REPORT_RANKING_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(MAX_REPORT_RANKING_LIMIT, {
    message: `El límite no puede superar ${MAX_REPORT_RANKING_LIMIT}`,
  })
  limit?: number;
}
