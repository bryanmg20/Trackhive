import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class GetRoomOccupancyQueryDto {
  @ApiProperty({
    description: 'Fecha inicial del rango (incluida), formato YYYY-MM-DD',
    example: '2026-11-01',
  })
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha inicial no es válida' })
  from: string;

  @ApiProperty({
    description: 'Fecha final del rango (incluida), formato YYYY-MM-DD',
    example: '2026-11-30',
  })
  @Matches(DATE_ONLY, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha final no es válida' })
  to: string;
}
