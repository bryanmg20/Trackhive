import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { readSessionRole } from '../auth/session';
import { BrandLogos } from '../brand/BrandLogos';
import { NavIcon } from '../navigation/NavIcon';
import { ROLE_LABEL } from '../navigation/sections';
import { SiteNav } from '../navigation/SiteNav';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
  /**
   * Optional bar shown below the content, e.g. the sticky «Solicitar» bar.
   * It stays outside <main>, in the content column, so it never covers the
   * side menu.
   */
  footer?: ReactNode;
}

/**
 * Layout shared by every screen with a session (WF-03 to WF-15): light
 * header with the CLENA and Uninorte logos, dark side menu by role and the
 * content column. Screens must use it instead of building their own shell.
 *
 * Mobile-first: below the tablet breakpoint the side menu folds behind the
 * «Menú» bar, so a 360 px phone never scrolls sideways.
 */
export function AppLayout({ children, footer }: AppLayoutProps) {
  const role = readSessionRole();

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>

      <header className={styles.topbar}>
        <span className={styles.brand}>
          <BrandLogos />
        </span>

        {role ? (
          <Link className={styles.account} to={ROUTES.profile}>
            <span className={styles.avatar} aria-hidden="true">
              <NavIcon name="user" />
            </span>
            <span className={styles.accountText}>
              <span className={styles.accountLabel}>Mi perfil</span>
              <span className={styles.accountRole}>{ROLE_LABEL[role]}</span>
            </span>
          </Link>
        ) : (
          <div className={styles.guestActions}>
            <Link className={styles.guestLink} to={ROUTES.login}>
              Inicio de sesión
            </Link>
            <Link className={styles.guestCta} to={ROUTES.register}>
              Crear cuenta
            </Link>
          </div>
        )}
      </header>

      <div className={role ? styles.body : `${styles.body} ${styles.guest}`}>
        {role ? (
          <div className={styles.sidebar}>
            <SiteNav className={styles.nav} />
          </div>
        ) : null}

        <div className={styles.content}>
          <main id="contenido" className={styles.main} tabIndex={-1}>
            {children}
          </main>
          {footer}
        </div>
      </div>
    </div>
  );
}
