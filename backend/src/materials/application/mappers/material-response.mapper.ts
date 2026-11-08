import { Material } from '../../domain/entities/material.entity';
import { MaterialResponseDto } from '../dto/material-response.dto';

export class MaterialResponseMapper {
  static toDto(
    material: Material,
    includeLocation: boolean,
  ): MaterialResponseDto {
    const dto: MaterialResponseDto = {
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
    if (includeLocation) {
      dto.location = { ...material.location };
    }
    return dto;
  }
}
