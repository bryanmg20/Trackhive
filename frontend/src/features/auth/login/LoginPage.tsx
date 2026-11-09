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
import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import { LoginApiError, loginUser } from '../api/login-user';
import { AuthLayout } from '../components/AuthLayout';
import { TextField } from '../components/TextField';
import { readRoleFromToken, saveSession, type UserRole } from '../session';
import { loginSchema, type LoginFormValues } from './login-schema';
import styles from './LoginPage.module.css';

const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos';
const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';
const GENERIC_ERROR_MESSAGE =
  'No pudimos iniciar su sesión. Inténtelo de nuevo.';

const HOME_BY_ROLE: Record<UserRole, string> = {
  PUBLICO: ROUTES.materials,
  PERSONAL: ROUTES.requests,
  ADMIN: ROUTES.requests,
};

interface LoginLocationState {
  registeredEmail?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const registeredEmail = state?.registeredEmail;
  const [formError, setFormError] = useState<string | null>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: registeredEmail ?? '',
      password: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  });

  useEffect(() => {
    if (!formError) {
      return;
    }

    formErrorRef.current?.focus();
  }, [formError]);

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);

    try {
      const session = await loginUser({
        email: values.email,
        password: values.password,
      });
      const role = readRoleFromToken(session.accessToken);

      if (!role) {
        setFormError(GENERIC_ERROR_MESSAGE);
        return;
      }

      saveSession(session);
      navigate(HOME_BY_ROLE[role], { replace: true });
    } catch (error) {
      if (error instanceof LoginApiError) {
        if (error.status === 401 || error.code === 'INVALID_CREDENTIALS') {
          setFormError(INVALID_CREDENTIALS_MESSAGE);
          return;
        }

        setFormError(
          error.status === 0 ? NETWORK_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE,
        );
        return;
      }

      setFormError(GENERIC_ERROR_MESSAGE);
    }
  };

  return (
    <AuthLayout spineLabel="ACCESO · USUARIO">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Acceso</p>
        <h1 className={styles.title}>Inicie sesión</h1>
      </header>

      {state?.registeredEmail ? (
        <p className={styles.lede}>Use el correo y la contraseña de su cuenta.</p>
      </header>

      {registeredEmail && !formError ? (
        <div className={styles.notice} role="status">
          <span className={styles.noticeMark} aria-hidden="true">
            ✓
          </span>
          <div>
            <p className={styles.noticeTitle}>Cuenta creada</p>
            <p className={styles.noticeBody}>
              Ya puede iniciar sesión con{' '}
              <strong>{state.registeredEmail}</strong>.
              Ya puede iniciar sesión con <strong>{registeredEmail}</strong>.
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
      {formError ? (
        <div
          className={styles.formError}
          ref={formErrorRef}
          role="alert"
          tabIndex={-1}
        >
          <span className={styles.formErrorMark} aria-hidden="true">
            !
          </span>
          <span>{formError}</span>
        </div>
      ) : null}

      <form
        className={styles.form}
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit(onSubmit)}
      >
        <TextField
          id="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.email?.message}
          registration={register('email')}
        />

        <TextField
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          registration={register('password')}
        />

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Iniciando sesión…
            </>
          ) : (
            'Iniciar sesión'
          )}
        </button>
      </form>

      <p className={styles.registerPrompt}>
        ¿Aún no tiene cuenta?{' '}
        <Link className={styles.registerLink} to={ROUTES.register}>
          Crear cuenta
          <span aria-hidden="true">→</span>
        </Link>
      </p>
    </AuthLayout>
  );
}
