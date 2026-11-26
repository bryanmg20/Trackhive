import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MATERIAL_REVIEW_REASONS } from '../../domain/enums/material-review-reason';
import type { MaterialReviewReason } from '../../domain/enums/material-review-reason';
import { MATERIAL_STATUSES } from '../../domain/enums/material-status';
import type { MaterialStatus } from '../../domain/enums/material-status';
import { MATERIAL_TYPES } from '../../domain/enums/material-type';
import type { MaterialType } from '../../domain/enums/material-type';

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

  @ApiProperty({
    description:
      'Indica si el material cuenta con una copia digital indexada en Everything (HU-140)',
    example: true,
  })
  hasDigitalCopy: boolean;

  @ApiPropertyOptional({
    description:
      'Solo para PERSONAL y ADMIN (HU-140): nombre de la carpeta en Everything, ' +
      'sin unidad ni ruta completa. Omitido para PUBLICO.',
    example: '1ra-1931 - Esc 0001-0109 - Ene',
    nullable: true,
    type: String,
  })
  digitalFolderName?: string | null;

  @ApiPropertyOptional({
    description:
      'Solo para PERSONAL y ADMIN (HU-140): indica si el material está marcado para revisión.',
    example: false,
  })
  needsReview?: boolean;

  @ApiPropertyOptional({
    description:
      'Solo para PERSONAL y ADMIN (HU-140): motivo de revisión asignado por la sincronización.',
    enum: MATERIAL_REVIEW_REASONS,
    nullable: true,
    example: null,
  })
  reviewReason?: MaterialReviewReason | null;
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
