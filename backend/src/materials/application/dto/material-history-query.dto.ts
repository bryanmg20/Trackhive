import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../../common/pagination';

export class MaterialHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Página actual, desde 1',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser al menos 1' })
  page?: number;

  @ApiPropertyOptional({
    description: 'Registros por página',
    default: DEFAULT_PAGE_LIMIT,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser al menos 1' })
  @Max(MAX_PAGE_LIMIT, {
    message: `El límite no puede superar ${MAX_PAGE_LIMIT}`,
  })
  limit?: number;
}
