import type { ReactNode } from 'react';
import { readSessionRole } from '../auth/session';
import { SiteNav } from '../navigation/SiteNav';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
  /**
   * Optional bar shown below the content, e.g. the sticky «Solicitar» bar.
   * It stays outside <main> so it can span the full width of the screen.
   */
  footer?: ReactNode;
}

/**
 * Layout shared by every screen with a session: brand, menu, header and the
 * content container. Screens must use it instead of building their own shell.
 *
 * Mobile-first: the header wraps and the menu flows onto its own line at
 * 360 px without causing horizontal scrolling.
 */
export function AppLayout({ children, footer }: AppLayoutProps) {
  const role = readSessionRole();
  const isStaff = role === 'PERSONAL' || role === 'ADMIN';

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <p className={styles.wordmark}>
            Trackhive<span className={styles.wordmarkDot}>.</span>
          </p>
          <p className={styles.brandTag}>
            {isStaff ? 'CLENA · Personal' : 'CLENA · Archivo'}
          </p>
        </div>
        <SiteNav className={styles.nav} />
      </header>

      <main className={styles.main}>{children}</main>

      {footer}
    </div>
  );
}
