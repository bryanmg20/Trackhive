import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../routes';
import {
  RegisterApiError,
  registerUser,
} from '../api/register-user';
import { AuthLayout } from '../components/AuthLayout';
import { TextField } from '../components/TextField';
import { PrivacyConsent } from './PrivacyConsent';
import {
  registerSchema,
  type RegisterFormValues,
} from './register-schema';
import styles from './RegisterPage.module.css';

const REDIRECT_DELAY_MS = 4000;
const DUPLICATE_EMAIL_MESSAGE =
  'Ya existe una cuenta con este correo. Inicie sesión.';
const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo.';
const GENERIC_ERROR_MESSAGE =
  'No pudimos crear su cuenta. Inténtelo de nuevo.';

const REGISTER_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'secondLastName',
  'email',
  'password',
  'confirmPassword',
] as const;

type RegisterField = (typeof REGISTER_FIELDS)[number];

function isRegisterField(value: string): value is RegisterField {
  return (REGISTER_FIELDS as readonly string[]).includes(value);
}

interface RegisterPageProps {
  redirectDelayMs?: number;
}

export function RegisterPage({
  redirectDelayMs = REDIRECT_DELAY_MS,
}: RegisterPageProps) {
  const navigate = useNavigate();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      secondLastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedPrivacy: false,
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

  useEffect(() => {
    if (!registeredEmail) {
      return;
    }

    successHeadingRef.current?.focus();

    const timeoutId = window.setTimeout(() => {
      navigate(ROUTES.login, {
        replace: true,
        state: { registeredEmail },
      });
    }, redirectDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [navigate, redirectDelayMs, registeredEmail]);

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);

    try {
      await registerUser({
        firstName: values.firstName,
        // Blank optional names are left out of the request, not sent as ''
        middleName: values.middleName || undefined,
        lastName: values.lastName,
        secondLastName: values.secondLastName || undefined,
        email: values.email,
        password: values.password,
      });
      setRegisteredEmail(values.email);
    } catch (error) {
      if (error instanceof RegisterApiError) {
        if (error.status === 409 || error.code === 'EMAIL_ALREADY_EXISTS') {
          setError(
            'email',
            { type: 'server', message: DUPLICATE_EMAIL_MESSAGE },
            { shouldFocus: true },
          );
          return;
        }

        if (error.details.length > 0) {
          let firstField: RegisterField | null = null;

          for (const detail of error.details) {
            if (isRegisterField(detail.field)) {
              setError(detail.field, {
                type: 'server',
                message: detail.messages.join(' '),
              });
              firstField ??= detail.field;
            }
          }

          if (firstField) {
            setFocus(firstField);
            return;
          }
        }

        setFormError(
          error.status === 0 ? NETWORK_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE,
        );
        return;
      }

      setFormError(GENERIC_ERROR_MESSAGE);
    }
  };

  if (registeredEmail) {
    return (
      <AuthLayout>
        <div className={styles.success}>
          <p className={styles.eyebrow}>Registro completado</p>
          <h1
            className={styles.successTitle}
            ref={successHeadingRef}
            tabIndex={-1}
          >
            Cuenta creada
          </h1>
          <p className={styles.successBody}>
            Ya puede iniciar sesión con <strong>{registeredEmail}</strong>.
          </p>
          <button
            type="button"
            className={styles.submit}
            onClick={() =>
              navigate(ROUTES.login, {
                replace: true,
                state: { registeredEmail },
              })
            }
          >
            Ir a iniciar sesión
          </button>
          <p className={styles.successNote}>
            Le llevaremos al inicio de sesión en unos segundos.
          </p>
          <span className={styles.stamp} aria-hidden="true">
            Cuenta
            <br />
            creada
          </span>
        </div>
        <p className="sr-only" role="status">
          Cuenta creada. Redirigiendo al inicio de sesión.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Registro</p>
        <h1 className={styles.title}>Cree su cuenta</h1>
        <p className={styles.lede}>
          Los campos marcados como opcionales pueden quedar vacíos.
        </p>
      </header>

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
        <div className={styles.nameRow}>
          <TextField
            id="firstName"
            label="Primer nombre"
            autoComplete="given-name"
            error={errors.firstName?.message}
            registration={register('firstName')}
          />

          <TextField
            id="middleName"
            label="Segundo nombre"
            optional
            autoComplete="additional-name"
            error={errors.middleName?.message}
            registration={register('middleName')}
          />
        </div>

        <div className={styles.nameRow}>
          <TextField
            id="lastName"
            label="Primer apellido"
            autoComplete="family-name"
            error={errors.lastName?.message}
            registration={register('lastName')}
          />

          {/* HTML has no autocomplete token for a second last name */}
          <TextField
            id="secondLastName"
            label="Segundo apellido"
            optional
            autoComplete="off"
            error={errors.secondLastName?.message}
            registration={register('secondLastName')}
          />
        </div>

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
          autoComplete="new-password"
          hint="Use al menos 8 caracteres."
          error={errors.password?.message}
          registration={register('password')}
        />

        <TextField
          id="confirmPassword"
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          registration={register('confirmPassword')}
        />

        <PrivacyConsent
          error={errors.acceptedPrivacy?.message}
          registration={register('acceptedPrivacy')}
        />

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Creando cuenta…
            </>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>

      <p className={styles.loginPrompt}>
        <Link className={styles.loginLink} to={ROUTES.login}>
          Ya tengo cuenta
          <span aria-hidden="true">→</span>
        </Link>
      </p>
    </AuthLayout>
  );
}
