import { ApiProperty } from '@nestjs/swagger';

export class MaterialRankingItemDto {
  @ApiProperty({
    description:
      'Puesto en el ranking. Los materiales con el mismo número de ' +
      'solicitudes comparten puesto (1, 2, 2, 4)',
    example: 1,
  })
  rank: number;

  @ApiProperty({ format: 'uuid' })
  materialId: string;

  @ApiProperty({ example: 'CLENA-DOC-0001' })
  catalogCode: string;

  @ApiProperty({ example: 'Actas del Concejo de 1890' })
  title: string;

  @ApiProperty({ example: 'DOCUMENTO' })
  materialType: string;

  @ApiProperty({
    description:
      'Solicitudes registradas en el periodo que incluyen el material',
    example: 12,
  })
  requestCount: number;
}

export class MostRequestedMaterialsResponseDto {
  @ApiProperty({
    description: 'Fecha inicial del filtro (YYYY-MM-DD) o null si no hay',
    example: '2026-11-01',
    nullable: true,
    type: String,
  })
  from: string | null;

  @ApiProperty({
    description: 'Fecha final del filtro (YYYY-MM-DD) o null si no hay',
    example: '2026-11-30',
    nullable: true,
    type: String,
  })
  to: string | null;

  @ApiProperty({
    description: 'Solicitudes registradas en el periodo, de cualquier material',
    example: 40,
  })
  totalRequests: number;

  @ApiProperty({
    type: MaterialRankingItemDto,
    isArray: true,
    description: 'Materiales de más a menos solicitados; empates por título',
  })
  items: MaterialRankingItemDto[];
}
