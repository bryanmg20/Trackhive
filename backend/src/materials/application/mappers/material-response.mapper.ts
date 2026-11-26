import type { UserRole } from '../../../users/domain/enums/user-role';
import { Material } from '../../domain/entities/material.entity';
import { canViewDigitalCopyDetails } from '../../domain/policies/material-digital-copy-visibility';
import {
  MaterialResponseDto,
  PaginatedMaterialsResponseDto,
} from '../dto/material-response.dto';

export class MaterialResponseMapper {
  static toDto(material: Material, viewerRole: UserRole): MaterialResponseDto {
    const base: MaterialResponseDto = {
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
      hasDigitalCopy: material.hasDigitalCopy,
    };

    if (!canViewDigitalCopyDetails(viewerRole)) {
      return base;
    }

    return {
      ...base,
      digitalFolderName: material.digitalFolderName,
      needsReview: material.needsReview,
      reviewReason: material.reviewReason,
    };
  }

  static toPaginatedDto(
    materials: Material[],
    pagination: { page: number; limit: number; total: number },
    viewerRole: UserRole,
  ): PaginatedMaterialsResponseDto {
    return {
      items: materials.map((material) =>
        MaterialResponseMapper.toDto(material, viewerRole),
      ),
      ...pagination,
    };
  }
}
