import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { AuthLayout } from '../components/AuthLayout';
import styles from './LoginPlaceholderPage.module.css';

interface LoginLocationState {
  registeredEmail?: string;
}

export function LoginPlaceholderPage() {
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const registeredEmail = state?.registeredEmail;

  return (
    <AuthLayout spineLabel="ACCESO · USUARIO">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Acceso</p>
        <h1 className={styles.title}>Inicie sesión</h1>
      </header>

      {registeredEmail ? (
        <div className={styles.notice} role="status">
          <span className={styles.noticeMark} aria-hidden="true">
            ✓
          </span>
          <div>
            <p className={styles.noticeTitle}>Cuenta creada</p>
            <p className={styles.noticeBody}>
              Ya puede iniciar sesión con <strong>{registeredEmail}</strong>.
            </p>
          </div>
        </div>
      ) : null}

      <p className={styles.body}>
        Estamos preparando el inicio de sesión. Mientras tanto, puede volver al
        registro.
      </p>

      <Link className={styles.backLink} to={ROUTES.register}>
        Volver al registro
      </Link>
    </AuthLayout>
  );
}
