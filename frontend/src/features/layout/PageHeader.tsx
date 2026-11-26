import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';
import { useDocumentTitle } from './use-document-title';

interface PageHeaderProps {
  /** Id for `aria-labelledby` of the section that owns the page. */
  titleId: string;
  title: ReactNode;
  /**
   * Browser tab title. Defaults to `title` when it is plain text; pass it
   * when the title is markup or needs context (e.g. «Solicitud SOL-…»).
   */
  documentTitle?: string;
  /** Short line above the title, e.g. the screen name when the title is a radicado. */
  kicker?: ReactNode;
  /** One sentence under the title, as the wireframe band shows it. */
  description?: ReactNode;
  /** Extra content inside the band (badges, the request status…). */
  children?: ReactNode;
}

/**
 * Header band of every signed-in screen (WF-03 to WF-15): title and one
 * line of description on the sand-coloured card.
 */
export function PageHeader({
  titleId,
  title,
  documentTitle,
  kicker,
  description,
  children,
}: PageHeaderProps) {
  useDocumentTitle(
    documentTitle ?? (typeof title === 'string' ? title : undefined),
  );

  return (
    <header className={styles.band}>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <h1 id={titleId} className={styles.title}>
        {title}
      </h1>
      {description ? <p className={styles.description}>{description}</p> : null}
      {children}
    </header>
  );
}
