import { ApiProperty } from '@nestjs/swagger';

export class DayOccupancyDto {
  @ApiProperty({ description: 'Día (YYYY-MM-DD)', example: '2026-11-20' })
  date: string;

  @ApiProperty({
    description: 'Citas en estado PROGRAMADA o CUMPLIDA para ese día',
    example: 4,
  })
  occupied: number;

  @ApiProperty({
    description: 'Cupos disponibles restantes ese día (mínimo 0)',
    example: 11,
  })
  available: number;

  @ApiProperty({
    description: 'Indica si la sala alcanzó o superó la capacidad diaria',
    example: false,
  })
  isFull: boolean;
}

export class RoomOccupancyResponseDto {
  @ApiProperty({
    description: 'Capacidad diaria vigente de la sala',
    example: 15,
  })
  dailyCapacity: number;

  @ApiProperty({
    type: DayOccupancyDto,
    isArray: true,
    description: 'Ocupación diaria dentro del rango consultado',
  })
  days: DayOccupancyDto[];
}
