import type { MaterialReviewReason } from '../../../materials/domain/enums/material-review-reason';
import type { MaterialType } from '../../../materials/domain/enums/material-type';

/**
 * What a complete run knows of a material (HU-137): the leaf folder that is
 * its digital copy and what the convention takes from its path (HU-136). It
 * is saved by catalogCode, never by path, so a folder renamed or moved with
 * the same code updates the same material instead of creating another one.
 */
export interface SyncedMaterial {
  readonly catalogCode: string;
  readonly title: string;
  readonly collection: string;
  readonly materialType: MaterialType;
  // Path of the leaf folder, as Everything sent it: the digital_path
  readonly digitalPath: string;
  readonly reviewReason: MaterialReviewReason | null;
  // When the run saw it: the last_seen_at
  readonly seenAt: Date;
}
