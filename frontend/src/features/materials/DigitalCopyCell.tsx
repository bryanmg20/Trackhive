import type { MaterialReviewReason } from './api/search-materials';
import styles from './DigitalCopyCell.module.css';
import { ReviewBadge } from './ReviewBadge';

export interface DigitalCopyCellProps {
  hasDigitalCopy: boolean;
  showDetails?: boolean;
  digitalFolderName?: string | null;
  needsReview?: boolean;
  reviewReason?: MaterialReviewReason | null;
}

/**
 * Digital copy table cell shared by public search and staff material lists
 * (HU-140). Public views omit folder name and review indicators.
 */
export function DigitalCopyCell({
  hasDigitalCopy,
  showDetails = false,
  digitalFolderName,
  needsReview,
  reviewReason,
}: DigitalCopyCellProps) {
  const badgeText = hasDigitalCopy
    ? showDetails
      ? 'Sí'
      : 'Sí · Disponible en digital'
    : 'No';

  return (
    <td data-label="Copia digital" className={styles.cell}>
      <span className={styles.badge} data-available={hasDigitalCopy}>
        {badgeText}
      </span>
      {showDetails && hasDigitalCopy && digitalFolderName ? (
        <code className={styles.folderName}>{digitalFolderName}</code>
      ) : null}
      {showDetails ? (
        <ReviewBadge
          needsReview={needsReview}
          reviewReason={reviewReason}
          className={styles.review}
        />
      ) : null}
    </td>
  );
}
