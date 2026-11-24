import type { SyncedMaterial } from '../../domain/value-objects/synced-material';
import type { ParsedLeaf } from '../dto/parsed-leaf';

/**
 * A leaf folder parsed with the convention (HU-136) → what a complete run
 * saves of its material (HU-137). The folder is the digital copy: its path
 * is the digital_path.
 */
export class SyncedMaterialMapper {
  static fromLeaf(leaf: ParsedLeaf, seenAt: Date): SyncedMaterial {
    return {
      catalogCode: leaf.catalogCode,
      title: leaf.title,
      collection: leaf.collection,
      materialType: leaf.materialType,
      digitalPath: leaf.fullPath,
      reviewReason: leaf.reviewReason,
      seenAt,
    };
  }
}
