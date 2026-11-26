import {
  MATERIAL_REVIEW_REASON_LABELS,
  type MaterialReviewReason,
} from './api/search-materials';
import styles from './ReviewBadge.module.css';

export interface ReviewBadgeProps {
  needsReview?: boolean;
  reviewReason?: MaterialReviewReason | null;
  className?: string;
}

/**
 * Staff-only badge indicating that a material synced from Everything needs
 * manual catalog-code review (HU-137, HU-140).
 */
export function ReviewBadge({
  needsReview,
  reviewReason,
  className,
}: ReviewBadgeProps) {
  if (!needsReview) {
    return null;
  }
  const classes = className ? `${styles.badge} ${className}` : styles.badge;
  return (
    <span className={classes}>
      Para revisión
      {reviewReason ? `: ${MATERIAL_REVIEW_REASON_LABELS[reviewReason]}` : ''}
    </span>
  );
}
