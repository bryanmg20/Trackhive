import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { logoutSession } from '../auth/api/logout-session';
import { readSessionRole } from '../auth/session';
import { NavIcon } from './NavIcon';
import { isSectionActive, ROLE_LABEL, sectionsForRole } from './sections';
import styles from './SiteNav.module.css';

interface SiteNavProps {
  className?: string;
}

/**
 * Menu with the sections the signed-in role can open (WF-03 to WF-15).
 *
 * Desktop: dark side column, always open. Below the tablet breakpoint it
 * folds behind a «Menú» button that opens a panel with the same options;
 * Escape closes it and returns the focus to the button.
 * A visitor without a session sees no menu.
 */
export function SiteNav({ className }: SiteNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = readSessionRole();
  const sections = sectionsForRole(role);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  if (!role) {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logoutSession();
    } finally {
      navigate(ROUTES.login, { replace: true });
    }
  };

  return (
    <nav
      className={[styles.nav, className].filter(Boolean).join(' ')}
      aria-label="Secciones"
    >
      <button
        ref={toggleRef}
        className={styles.toggle}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <NavIcon name={isOpen ? 'close' : 'menu'} />
        <span className={styles.toggleLabel}>Menú</span>
        <span className={styles.roleTag}>{ROLE_LABEL[role]}</span>
      </button>

      <div id={panelId} className={styles.panel} data-open={isOpen}>
        <p className={styles.kicker}>Archivo histórico</p>
        <ul className={styles.list}>
          {sections.map((section) => {
            const active = isSectionActive(section, pathname);

            return (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className={active ? `${styles.link} ${styles.active}` : styles.link}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setIsOpen(false)}
                >
                  <NavIcon name={section.icon} className={styles.icon} />
                  <span>{section.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          className={styles.logout}
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </nav>
  );
}
