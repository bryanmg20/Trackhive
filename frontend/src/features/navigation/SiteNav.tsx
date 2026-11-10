import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { logoutSession } from '../auth/api/logout-session';
import { readSessionRole } from '../auth/session';
import { sectionsForRole } from './sections';
import styles from './SiteNav.module.css';

interface SiteNavProps {
  className?: string;
}

/**
 * Menu with the sections the signed-in role can open.
 * A visitor without a session sees no links.
 */
export function SiteNav({ className }: SiteNavProps) {
  const navigate = useNavigate();
  const role = readSessionRole();
  const sections = sectionsForRole(role);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      {sections.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end
          className={({ isActive }) =>
            isActive ? `${styles.link} ${styles.active}` : styles.link
          }
        >
          {section.label}
        </NavLink>
      ))}
      <button
        className={styles.logout}
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </nav>
  );
}
