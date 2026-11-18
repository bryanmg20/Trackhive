import { MaterialModel, Prisma } from '@prisma/client';
import {
  Material,
  MaterialLocation,
} from '../../domain/entities/material.entity';
import { InvalidMaterialStatusError } from '../../domain/errors/invalid-material-status.error';
import { InvalidMaterialTypeError } from '../../domain/errors/invalid-material-type.error';
import { InvalidMaterialSourceError } from '../../domain/errors/invalid-material-source.error';
import { isMaterialSource } from '../../domain/enums/material-source';
import { isMaterialStatus } from '../../domain/enums/material-status';
import { isMaterialType } from '../../domain/enums/material-type';

export class PrismaMaterialMapper {
  static toDomain(model: MaterialModel): Material {
    if (!isMaterialType(model.materialType)) {
      throw new InvalidMaterialTypeError();
    }
    if (!isMaterialStatus(model.status)) {
      throw new InvalidMaterialStatusError();
    }
    if (!isMaterialSource(model.source)) {
      throw new InvalidMaterialSourceError();
    }
    return new Material({
      id: model.id,
      catalogCode: model.catalogCode,
      title: model.title,
      materialType: model.materialType,
      author: model.author,
      collection: model.collection,
      publicationDate: model.publicationDate,
      publisher: model.publisher,
      location: PrismaMaterialMapper.toLocation(model),
      status: model.status,
      source: model.source,
      digitalPath: model.digitalPath,
      lastSeenAt: model.lastSeenAt,
      statusChangedAt: model.statusChangedAt,
      statusChangedBy: model.statusChangedById,
      statusChangeReason: model.statusChangeReason,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  /**
   * The physical location, or null when the material has none (HU-134). The
   * CHECK of the table keeps the three columns together.
   */
  static toLocation(
    model: Pick<MaterialModel, 'depot' | 'shelf' | 'box'>,
  ): MaterialLocation | null {
    const { depot, shelf, box } = model;
    if (depot === null || shelf === null || box === null) {
      return null;
    }
    return { depot, shelf, box };
  }

  /** The status of the material and who changed it last (HU-08). */
  static toStatusUpdate(
    material: Material,
  ): Prisma.MaterialModelUncheckedUpdateInput {
    return {
      status: material.status,
      statusChangedAt: material.statusChangedAt,
      statusChangedById: material.statusChangedBy,
      statusChangeReason: material.statusChangeReason,
    };
  }
}
