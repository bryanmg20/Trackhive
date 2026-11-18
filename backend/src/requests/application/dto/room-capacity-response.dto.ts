import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoomCapacityUpdatedByDto {
  @ApiProperty({ example: '7a1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'Admin Demo' })
  name: string;
}

export class RoomCapacityResponseDto {
  @ApiProperty({
    description: 'Límite diario de citas en la sala de consulta',
    example: 15,
  })
  dailyCapacity: number;

  @ApiProperty({
    description:
      'Indica si se está usando la capacidad por defecto (15) por no existir ' +
      'una configuración guardada',
    example: true,
  })
  isDefault: boolean;

  @ApiPropertyOptional({
    description: 'Fecha y hora ISO del último cambio, o null si es por defecto',
    example: '2026-11-18T03:00:00.000Z',
    nullable: true,
  })
  updatedAt: string | null;

  @ApiPropertyOptional({
    type: RoomCapacityUpdatedByDto,
    description: 'Administrador que realizó el último cambio, o null',
    nullable: true,
  })
  updatedBy: RoomCapacityUpdatedByDto | null;
}
