import {
  isMaterialReviewReason,
  type MaterialReviewReason,
} from '../enums/material-review-reason';
import { InvalidMaterialReviewReasonError } from '../errors/invalid-material-review-reason.error';
import { extractDigitalFolderName } from './digital-copy-name';

export interface MaterialDigitalCopyInfo {
  readonly hasDigitalCopy: boolean;
  readonly digitalFolderName: string | null;
  readonly needsReview: boolean;
  readonly reviewReason: MaterialReviewReason | null;
}

/** Whether a stored Everything path points to a valid digital copy folder (HU-139, HU-140). */
export function hasValidDigitalCopy(
  digitalPath: string | null | undefined,
): boolean {
  return extractDigitalFolderName(digitalPath) !== null;
}

/**
 * Validates a stored or incoming material review reason (HU-137).
 * Backed at the database level by `materials_review_reason_check`.
 */
export function parseMaterialReviewReason(
  value: string | null | undefined,
): MaterialReviewReason | null {
  const reviewReason = value ?? null;
  if (reviewReason !== null && !isMaterialReviewReason(reviewReason)) {
    throw new InvalidMaterialReviewReasonError();
  }
  return reviewReason;
}

/**
 * Resolves digital availability, leaf folder name and review status for a
 * material using a single shared domain rule (HU-137, HU-139, HU-140).
 */
export function resolveMaterialDigitalCopy(input: {
  digitalPath?: string | null;
  reviewReason?: string | null;
}): MaterialDigitalCopyInfo {
  const reviewReason = parseMaterialReviewReason(input.reviewReason);
  const digitalFolderName = extractDigitalFolderName(input.digitalPath);
  return {
    hasDigitalCopy: digitalFolderName !== null,
    digitalFolderName,
    needsReview: reviewReason !== null,
    reviewReason,
  };
}
