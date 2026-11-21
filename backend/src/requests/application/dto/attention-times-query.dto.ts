import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class AttentionTimesQueryDto {
  @ApiPropertyOptional({
    description: 'Radicación desde, incluida, hora de Bogotá (YYYY-MM-DD)',
    example: '2026-11-01',
  })
  @Transform(trim)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true }, { message: 'La fecha inicial no es válida' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Radicación hasta, incluida, hora de Bogotá (YYYY-MM-DD)',
    example: '2026-11-30',
  })
  @Transform(trim)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato YYYY-MM-DD',
  })
  @IsISO8601({ strict: true }, { message: 'La fecha final no es válida' })
  to?: string;
}
