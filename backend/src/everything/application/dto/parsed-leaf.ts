import type { MaterialReviewReason } from '../../../materials/domain/enums/material-review-reason';
import type { MaterialType } from '../../../materials/domain/enums/material-type';

/**
 * NO_PATTERN: the folder does not follow the pattern of its fund (or the fund
 * has none). DUPLICATE_CODE: another leaf gave the same code. The sync saves
 * it in materials.review_reason (HU-137).
 */
export type ReviewReason = MaterialReviewReason;

/**
 * A leaf folder turned into a material (HU-136). Every leaf has a digital
 * copy: the CLENA only puts there what it already digitized. The sync
 * (HU-137) recognizes the material by catalogCode.
 */
export interface ParsedLeaf {
  // Path of the folder as Everything sent it: the digital_path
  fullPath: string;
  // Path under the root of the fund, with `\`
  relativePath: string;
  folderName: string;
  // Code from the pattern, or null if the folder does not follow it
  parsedCode: string | null;
  // At most 40 characters (materials.catalog_code)
  catalogCode: string;
  title: string;
  collection: string;
  materialType: MaterialType;
  needsReview: boolean;
  reviewReason: ReviewReason | null;
}
