import { MaterialModel } from '@prisma/client';
import { Material } from '../../domain/entities/material.entity';
import { InvalidMaterialStatusError } from '../../domain/errors/invalid-material-status.error';
import { InvalidMaterialTypeError } from '../../domain/errors/invalid-material-type.error';
import { isMaterialStatus } from '../../domain/material-status';
import { isMaterialType } from '../../domain/material-type';

export class PrismaMaterialMapper {
  static toDomain(model: MaterialModel): Material {
    if (!isMaterialType(model.materialType)) {
      throw new InvalidMaterialTypeError();
    }
    if (!isMaterialStatus(model.status)) {
      throw new InvalidMaterialStatusError();
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
      location: { depot: model.depot, shelf: model.shelf, box: model.box },
      status: model.status,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }
}
