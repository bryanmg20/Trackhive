import { Prisma } from '@prisma/client';
import type { SyncedMaterial } from '../../domain/value-objects/synced-material';

/** The columns of materials that the sync knows and keeps up to date. */
interface SyncedColumns {
  title: string;
  collection: string;
  materialType: string;
  source: string;
  digitalPath: string;
  lastSeenAt: Date;
  reviewReason: string | null;
}

/**
 * What a complete run writes in materials (HU-137, D-05). A material is
 * recognized by catalog_code: a new one is created available, and one that
 * already exists only changes what the sync knows (its folder, title,
 * collection, type and review mark). Its status, author, publication data
 * and status changes belong to the staff and never change here.
 */
export class PrismaSyncedMaterialMapper {
  static toCreate(
    material: SyncedMaterial,
    id: string,
  ): Prisma.MaterialModelUncheckedCreateInput {
    return {
      id,
      catalogCode: material.catalogCode,
      status: 'DISPONIBLE',
      author: null,
      publicationDate: null,
      publisher: null,
      ...PrismaSyncedMaterialMapper.toUpdate(material),
    };
  }

  static toUpdate(material: SyncedMaterial): SyncedColumns {
    return {
      title: material.title,
      collection: material.collection,
      materialType: material.materialType,
      source: 'EVERYTHING',
      digitalPath: material.digitalPath,
      lastSeenAt: material.seenAt,
      reviewReason: material.reviewReason,
    };
  }

  /**
   * «Copia digital no encontrada»: without digital_path (HU-134). The
   * material, its requests and its last_seen_at stay.
   */
  static toDigitalCopyNotFound(): Prisma.MaterialModelUncheckedUpdateManyInput {
    return { digitalPath: null };
  }
}
