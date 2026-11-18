import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_DAILY_ROOM_CAPACITY } from '../../domain/policies/room-capacity';

export class UpdateRoomCapacityDto {
  @ApiProperty({
    description: 'Nueva capacidad diaria de citas (entero mayor que 0)',
    example: 20,
    minimum: 1,
    maximum: MAX_DAILY_ROOM_CAPACITY,
  })
  @IsInt({ message: 'La capacidad diaria debe ser un número entero' })
  @Min(1, { message: 'La capacidad diaria debe ser mayor que 0' })
  @Max(MAX_DAILY_ROOM_CAPACITY, {
    message: `La capacidad diaria no puede superar ${MAX_DAILY_ROOM_CAPACITY}`,
  })
  dailyCapacity: number;
}
