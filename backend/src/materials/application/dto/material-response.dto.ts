import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MATERIAL_STATUSES } from '../../domain/material-status';
import type { MaterialStatus } from '../../domain/material-status';
import { MATERIAL_TYPES } from '../../domain/material-type';
import type { MaterialType } from '../../domain/material-type';

export class MaterialLocationDto {
  @ApiProperty({ description: 'Depósito', example: 'D-01' })
  depot: string;

  @ApiProperty({ description: 'Estante', example: 'E-12' })
  shelf: string;

  @ApiProperty({ description: 'Caja', example: 'C-034' })
  box: string;
}

export class MaterialResponseDto {
  @ApiProperty({
    description: 'Identificador único del material',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({
    description: 'Código de catalogación único',
    example: 'AHM-DOC-0001',
  })
  catalogCode: string;

  @ApiProperty({
    description: 'Título del material',
    example: 'Acta del Cabildo de 1810',
  })
  title: string;

  @ApiProperty({ description: 'Tipo de material', enum: MATERIAL_TYPES })
  materialType: MaterialType;

  @ApiProperty({
    description: 'Autor; null si no se conoce',
    example: 'Cabildo de Medellín',
    nullable: true,
    type: String,
  })
  author: string | null;

  @ApiProperty({
    description: 'Colección o tema',
    example: 'Actas del Cabildo',
  })
  collection: string;

  @ApiProperty({
    description: 'Fecha de publicación (solo periódicos), formato YYYY-MM-DD',
    example: '1915-03-21',
    nullable: true,
    type: String,
  })
  publicationDate: string | null;

  @ApiProperty({
    description: 'Empresa editora (solo periódicos)',
    example: 'El Espectador',
    nullable: true,
    type: String,
  })
  publisher: string | null;

  @ApiProperty({ description: 'Estado del material', enum: MATERIAL_STATUSES })
  status: MaterialStatus;

  @ApiPropertyOptional({
    description:
      'Ubicación física. Solo se envía a los roles PERSONAL y ADMIN; nunca al rol PUBLICO',
    type: MaterialLocationDto,
  })
  location?: MaterialLocationDto;
}

export class PaginatedMaterialsResponseDto {
  @ApiProperty({ type: [MaterialResponseDto] })
  items: MaterialResponseDto[];

  @ApiProperty({ description: 'Página actual, desde 1', example: 1 })
  page: number;

  @ApiProperty({ description: 'Materiales por página', example: 20 })
  limit: number;

  @ApiProperty({
    description: 'Total de materiales que cumplen la búsqueda',
    example: 30,
  })
  total: number;
}
