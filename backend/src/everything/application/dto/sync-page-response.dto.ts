import { ApiProperty } from '@nestjs/swagger';

export class SyncPageResponseDto {
  @ApiProperty({ description: 'Identificador de la corrida', format: 'uuid' })
  runId: string;

  @ApiProperty({ description: 'Número de la página guardada', example: 1 })
  pageNumber: number;

  @ApiProperty({
    description: 'Resultados de Everything en la página',
    example: 50,
  })
  results: number;

  @ApiProperty({
    description: 'Carpetas de la página que esperan al cierre de la corrida',
    example: 50,
  })
  folders: number;

  @ApiProperty({
    description: 'Resultados recibidos en toda la corrida hasta ahora',
    example: 50,
  })
  filesCount: number;
}
