import type { Material } from '../../../materials/domain/entities/material.entity';
import type { SavedReferenceResolution } from '../../domain/value-objects/reference-resolution';
import { describeMaterialReference } from '../../domain/value-objects/material-reference';
import {
  RequestReferenceDto,
  ResolveReferenceResponseDto,
} from '../dto/request-reference-response.dto';
import { RequestListReferenceDto } from '../dto/request-list-response.dto';
import type {
  RequestDetailReference,
  RequestListItem,
} from '../ports/request-query.port';
import { PersonNameMapper } from './person-name.mapper';
import { StatusChangeResponseMapper } from './status-change-response.mapper';

/** A written reference (HU-09.2) → the response the staff reads. */
export class RequestReferenceResponseMapper {
  static toDto(reference: RequestDetailReference): RequestReferenceDto {
    return {
      id: reference.id,
      kind: reference.kind,
      label: describeMaterialReference(reference),
      notary: reference.notary,
      year: reference.year,
      deedNumber: reference.deedNumber,
      description: reference.description,
      status: reference.status,
      material: reference.material,
      resolvedAt: reference.resolvedAt?.toISOString() ?? null,
      resolvedBy: reference.resolvedBy
        ? {
            id: reference.resolvedBy.id,
            name: PersonNameMapper.fullName(reference.resolvedBy),
          }
        : null,
    };
  }

  static toListDto(
    reference: RequestListItem['references'][number],
  ): RequestListReferenceDto {
    return {
      id: reference.id,
      kind: reference.kind,
      label: describeMaterialReference(reference),
      status: reference.status,
    };
  }

  static toResolutionDto(
    requestId: string,
    saved: SavedReferenceResolution,
    material: Pick<Material, 'id' | 'catalogCode' | 'title'>,
  ): ResolveReferenceResponseDto {
    return {
      requestId,
      reference: RequestReferenceResponseMapper.toDto({
        ...saved.reference,
        material: {
          id: material.id,
          catalogCode: material.catalogCode,
          title: material.title,
        },
        resolvedAt: saved.resolvedAt,
        resolvedBy: saved.historyEntry.changedBy,
      }),
      historyEntry: StatusChangeResponseMapper.toDto(saved.historyEntry),
    };
  }
}
