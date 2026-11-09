import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AuthLayout } from '../auth/components/AuthLayout';
import styles from './PendingPage.module.css';

interface PendingPageProps {
  title: string;
  spineLabel: string;
}

/** Temporary destination until the real screen (HU-12) exists. */
export function PendingPage({ title, spineLabel }: PendingPageProps) {
  return (
    <AuthLayout spineLabel={spineLabel}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Sesión iniciada</p>
        <h1 className={styles.title}>{title}</h1>
      </header>

      <p className={styles.body}>Estamos preparando esta pantalla.</p>

      <Link className={styles.link} to={ROUTES.login}>
        Volver al inicio de sesión
      </Link>
    </AuthLayout>
  );
}
