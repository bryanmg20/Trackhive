import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok' | 'degraded';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database: 'up' | 'down';
}
