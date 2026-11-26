import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { BrandLogos } from '../../brand/BrandLogos';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
  /**
   * `access` (WF-01): welcome panel on the left and the form card on the
   * right. `wide` (WF-02): the form uses the whole width under the header
   * band that the page draws itself.
   */
  variant?: 'access' | 'wide';
}

/**
 * Screens without a session (WF-01 login, WF-02 register): the CLENA and
 * Uninorte logos with «Inicio de sesión» and «Crear cuenta», no session
 * menu.
 */
export function AuthLayout({ children, variant = 'access' }: AuthLayoutProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <BrandLogos />
        <nav className={styles.actions} aria-label="Acceso">
          <Link className={styles.loginLink} to={ROUTES.login}>
            Inicio de sesión
          </Link>
          <Link className={styles.registerLink} to={ROUTES.register}>
            Crear cuenta
          </Link>
        </nav>
      </header>

      {variant === 'access' ? (
        <main className={styles.access}>
          <section className={styles.welcome} aria-label="Presentación">
            <p className={styles.statement}>La historia nos conecta.</p>
            <p className={styles.welcomeBody}>
              Consulte el patrimonio documental del Archivo Histórico del
              Atlántico.
            </p>
          </section>
          <div className={styles.card}>{children}</div>
        </main>
      ) : (
        <main className={styles.wide}>{children}</main>
      )}
    </div>
  );
}
