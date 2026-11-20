import { ApiProperty } from '@nestjs/swagger';
import { MATERIAL_REFERENCE_KINDS } from '../../domain/enums/material-reference-kind';
import type { MaterialReferenceKind } from '../../domain/enums/material-reference-kind';
import { MATERIAL_REFERENCE_STATUSES } from '../../domain/enums/material-reference-status';
import type { MaterialReferenceStatus } from '../../domain/enums/material-reference-status';
import {
  StatusChangeDto,
  StatusChangeUserDto,
} from './change-request-status-response.dto';

export class RequestReferenceMaterialDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'TH-PER-0101' })
  catalogCode: string;

  @ApiProperty({ example: 'El Heraldo, 15-03-1950' })
  title: string;
}

/** A written reference of a request and its status (HU-09.2). */
export class RequestReferenceDto {
  @ApiProperty({ example: '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ enum: MATERIAL_REFERENCE_KINDS, example: 'TEXTO_LIBRE' })
  kind: MaterialReferenceKind;

  @ApiProperty({
    description: 'La referencia lista para mostrar',
    example: 'El Heraldo, 15-03-1950',
  })
  label: string;

  @ApiProperty({ nullable: true, type: String })
  notary: string | null;

  @ApiProperty({ nullable: true, type: Number })
  year: number | null;

  @ApiProperty({ nullable: true, type: String })
  deedNumber: string | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ enum: MATERIAL_REFERENCE_STATUSES, example: 'PENDIENTE' })
  status: MaterialReferenceStatus;

  @ApiProperty({
    description: 'Material del catálogo asociado; null si está pendiente',
    type: RequestReferenceMaterialDto,
    nullable: true,
  })
  material: RequestReferenceMaterialDto | null;

  @ApiProperty({
    description: 'Cuándo se asoció el material; null si está pendiente',
    nullable: true,
    type: String,
  })
  resolvedAt: string | null;

  @ApiProperty({
    description: 'Quién asoció el material; null si está pendiente',
    type: StatusChangeUserDto,
    nullable: true,
  })
  resolvedBy: StatusChangeUserDto | null;
}

export class ResolveReferenceResponseDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  requestId: string;

  @ApiProperty({ type: RequestReferenceDto })
  reference: RequestReferenceDto;

  @ApiProperty({
    type: StatusChangeDto,
    description: 'Registro guardado en el historial, con quien lo hizo',
  })
  historyEntry: StatusChangeDto;
}
