import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { loginUser } from '../api/login-user';
import { AuthLayout } from '../components/AuthLayout';
import styles from './LoginPage.module.css';

interface LoginLocationState {
  registeredEmail?: string;
  accessDenied?: boolean;
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;
  const [email, setEmail] = useState(state?.registeredEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    state?.accessDenied
      ? 'Esta funcionalidad está disponible solo para cuentas públicas.'
      : '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const session = await loginUser({ email, password });
      localStorage.setItem('accessToken', session.accessToken);
      localStorage.setItem('refreshToken', session.refreshToken);
      navigate(ROUTES.newRequest, { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'No se pudo iniciar sesión.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout spineLabel="ACCESO · USUARIO">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Acceso</p>
        <h1 className={styles.title}>Inicie sesión</h1>
      </header>

      {state?.registeredEmail ? (
        <div className={styles.notice} role="status">
          <span className={styles.noticeMark} aria-hidden="true">
            ✓
          </span>
          <div>
            <p className={styles.noticeTitle}>Cuenta creada</p>
            <p className={styles.noticeBody}>
              Ya puede iniciar sesión con{' '}
              <strong>{state.registeredEmail}</strong>.
            </p>
          </div>
        </div>
      ) : null}

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>

      <Link className={styles.backLink} to={ROUTES.register}>
        Volver al registro
      </Link>
    </AuthLayout>
  );
}
