import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestResponseDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
  id: string;

  @ApiProperty({ example: 'SOL-2026-00001' })
  trackingCode: string;

  @ApiProperty({ example: 'RECIBIDA' })
  status: 'RECIBIDA';
}
