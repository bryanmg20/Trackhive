import { ApiProperty } from '@nestjs/swagger';

export class TestEmailResponseDto {
  @ApiProperty({
    description: 'Correo al que se envió la prueba: el del administrador',
    example: 'admin@example.com',
  })
  sentTo: string;
}
