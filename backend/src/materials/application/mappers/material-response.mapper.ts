import { Material } from '../../domain/entities/material.entity';
import {
  MaterialResponseDto,
  PaginatedMaterialsResponseDto,
} from '../dto/material-response.dto';

export class MaterialResponseMapper {
  static toDto(material: Material): MaterialResponseDto {
    return {
      id: material.id,
      catalogCode: material.catalogCode,
      title: material.title,
      materialType: material.materialType,
      author: material.author,
      collection: material.collection,
      // Date-only column: send YYYY-MM-DD, without time or time zone
      publicationDate:
        material.publicationDate?.toISOString().slice(0, 10) ?? null,
      publisher: material.publisher,
      status: material.status,
    };
  }

  static toPaginatedDto(
    materials: Material[],
    pagination: { page: number; limit: number; total: number },
  ): PaginatedMaterialsResponseDto {
    return {
      items: materials.map((material) =>
        MaterialResponseMapper.toDto(material),
      ),
      ...pagination,
    };
  }
}
