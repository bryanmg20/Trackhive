import { ApiProperty } from '@nestjs/swagger';
import { DELIVERY_MODES } from '../../domain/enums/delivery-mode';
import { MATERIAL_REFERENCE_KINDS } from '../../domain/enums/material-reference-kind';
import type { MaterialReferenceKind } from '../../domain/enums/material-reference-kind';
import { MATERIAL_REFERENCE_STATUSES } from '../../domain/enums/material-reference-status';
import type { MaterialReferenceStatus } from '../../domain/enums/material-reference-status';
import type { DeliveryMode } from '../../domain/enums/delivery-mode';
import { REQUEST_STATUSES } from '../../domain/enums/request-status';
import type { RequestStatus } from '../../domain/enums/request-status';

export class RequestListMaterialDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'TH-DOC-0001' })
  catalogCode: string;

  @ApiProperty({ example: 'Acta de fundación de la villa' })
  title: string;
}

/** A written reference of the request, as a listing shows it (HU-09.2). */
export class RequestListReferenceDto {
  @ApiProperty({ example: '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ enum: MATERIAL_REFERENCE_KINDS, example: 'TEXTO_LIBRE' })
  kind: MaterialReferenceKind;

  @ApiProperty({ example: 'El Heraldo, 15-03-1950' })
  label: string;

  @ApiProperty({ enum: MATERIAL_REFERENCE_STATUSES, example: 'PENDIENTE' })
  status: MaterialReferenceStatus;
}

export class RequestListItemDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({
    description: 'Código de seguimiento',
    example: 'SOL-2026-00001',
  })
  trackingCode: string;

  @ApiProperty({ enum: REQUEST_STATUSES })
  status: RequestStatus;

  @ApiProperty({ enum: DELIVERY_MODES })
  deliveryMode: DeliveryMode;

  @ApiProperty({
    description: 'Fecha deseada, formato YYYY-MM-DD',
    example: '2026-12-01',
  })
  desiredDate: string;

  @ApiProperty({
    description: 'Fecha y hora de radicación',
    example: '2026-11-10T15:00:00.000Z',
  })
  registeredAt: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Juan Carlos Pérez' })
  requesterName: string;

  @ApiProperty({ nullable: true, type: String, example: 'juan@mail.com' })
  requesterEmail: string | null;

  @ApiProperty({ type: [RequestListMaterialDto] })
  materials: RequestListMaterialDto[];

  @ApiProperty({
    description:
      'Materiales que no están en el catálogo, descritos por escrito, y su estado (HU-09.2)',
    type: [RequestListReferenceDto],
  })
  references: RequestListReferenceDto[];
}

export class PaginatedRequestsResponseDto {
  @ApiProperty({ type: [RequestListItemDto] })
  items: RequestListItemDto[];

  @ApiProperty({ description: 'Página actual, desde 1', example: 1 })
  page: number;

  @ApiProperty({ description: 'Solicitudes por página', example: 20 })
  limit: number;

  @ApiProperty({
    description: 'Total de solicitudes que cumplen los filtros',
    example: 12,
  })
  total: number;
}
