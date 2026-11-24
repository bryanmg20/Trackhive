/**
 * Why the Everything sync left a material for the staff to review (HU-136,
 * HU-137): its folder does not follow the convention of its fund
 * (NO_PATTERN), or another folder gave the same code (DUPLICATE_CODE). Either
 * way its catalog code comes from the path of the folder.
 */
export const MATERIAL_REVIEW_REASONS = [
  'NO_PATTERN',
  'DUPLICATE_CODE',
] as const;

export type MaterialReviewReason = (typeof MATERIAL_REVIEW_REASONS)[number];

export function isMaterialReviewReason(
  value: string,
): value is MaterialReviewReason {
  return (MATERIAL_REVIEW_REASONS as readonly string[]).includes(value);
}
