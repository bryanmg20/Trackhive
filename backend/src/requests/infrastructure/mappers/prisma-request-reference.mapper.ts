import type { Prisma } from '@prisma/client';
import { isMaterialReferenceKind } from '../../domain/enums/material-reference-kind';
import { isMaterialReferenceStatus } from '../../domain/enums/material-reference-status';
import type { MaterialReference } from '../../domain/value-objects/material-reference';
import type {
  ReferenceResolution,
  SavedReferenceResolution,
} from '../../domain/value-objects/reference-resolution';
import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';

/** The columns of request_references the entity needs (HU-09.2). */
export interface RequestReferenceRow {
  id: string;
  kind: string;
  notary: string | null;
  deedYear: number | null;
  deedNumber: string | null;
  description: string | null;
  status: string;
  materialId: string | null;
}

/** What the repository reads of each reference of a request. */
export const REQUEST_REFERENCE_SELECT = {
  id: true,
  kind: true,
  notary: true,
  deedYear: true,
  deedNumber: true,
  description: true,
  status: true,
  materialId: true,
} satisfies Prisma.RequestReferenceModelSelect;

/** Translates between a written reference and request_references (HU-09.2). */
export class PrismaRequestReferenceMapper {
  static toDomain(row: RequestReferenceRow): MaterialReference {
    if (
      !isMaterialReferenceKind(row.kind) ||
      !isMaterialReferenceStatus(row.status)
    ) {
      throw new Error(
        `Request reference ${row.id} has an invalid stored value`,
      );
    }
    return Object.freeze({
      id: row.id,
      kind: row.kind,
      notary: row.notary,
      year: row.deedYear,
      deedNumber: row.deedNumber,
      description: row.description,
      status: row.status,
      materialId: row.materialId,
    });
  }

  /** The reference as the screens read it, without its material id. */
  static toReadModel(
    row: RequestReferenceRow,
  ): Omit<MaterialReference, 'materialId'> {
    const reference = PrismaRequestReferenceMapper.toDomain(row);
    return {
      id: reference.id,
      kind: reference.kind,
      notary: reference.notary,
      year: reference.year,
      deedNumber: reference.deedNumber,
      description: reference.description,
      status: reference.status,
    };
  }

  /** A new reference, inserted with its request (always PENDIENTE). */
  static toPersistence(
    reference: MaterialReference,
  ): Prisma.RequestReferenceModelCreateWithoutRequestInput {
    return {
      id: reference.id,
      kind: reference.kind,
      notary: reference.notary,
      deedYear: reference.year,
      deedNumber: reference.deedNumber,
      description: reference.description,
      status: reference.status,
    };
  }

  /** The reference gets its catalog material, who did it and when. */
  static toResolved(
    resolution: ReferenceResolution,
  ): Prisma.RequestReferenceModelUncheckedUpdateManyInput {
    return {
      status: 'RESUELTA',
      materialId: resolution.materialId,
      resolvedById: resolution.resolvedBy,
      resolvedAt: resolution.resolvedAt,
    };
  }

  /** The reference as the resolution left it, with its history row. */
  static toSavedResolution(
    row: RequestReferenceRow & { resolvedAt: Date | null },
    historyEntry: SavedStatusChange,
  ): SavedReferenceResolution {
    if (!row.resolvedAt) {
      throw new Error(`Request reference ${row.id} was not resolved`);
    }
    return {
      reference: PrismaRequestReferenceMapper.toDomain(row),
      resolvedAt: row.resolvedAt,
      historyEntry,
    };
  }

  /** The item of the material in the request, so it is scheduled and counted. */
  static toRequestItem(
    resolution: ReferenceResolution,
    id: string,
  ): Prisma.RequestItemModelCreateManyInput {
    return {
      id,
      requestId: resolution.requestId,
      materialId: resolution.materialId,
      itemStatus: 'PENDIENTE',
    };
  }
}
