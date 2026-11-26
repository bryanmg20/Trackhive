import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AppLayout } from '../layout/AppLayout';
import { PageHeader } from '../layout/PageHeader';
import { useDocumentTitle } from '../layout/use-document-title';
import { RequestApiError } from '../requests/api/request-api-error';
import { CharacterizationFields } from './CharacterizationFields';
import {
  characterizationSchema,
  type CharacterizationValues,
} from './characterization';
import { profileApi, type MyProfile } from './profile-api';
import styles from './ProfilePage.module.css';
import { DeleteAccountSection } from './DeleteAccountSection';

function ProfileForm({ profile }: { profile: MyProfile }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CharacterizationValues>({
    resolver: zodResolver(characterizationSchema),
    defaultValues: {
      municipality: profile.municipality ?? '',
      ageRange: profile.ageRange ?? '',
      populationGroup: profile.populationGroup ?? '',
    },
  });

  async function save(values: CharacterizationValues) {
    setMessage('');
    setError('');
    setExpired(false);
    try {
      const saved = await profileApi(values);
      reset({
        municipality: saved.municipality ?? '',
        ageRange: saved.ageRange ?? '',
        populationGroup: saved.populationGroup ?? '',
      });
      setMessage('Sus datos se guardaron correctamente.');
    } catch (caught) {
      setExpired(caught instanceof RequestApiError && caught.status === 401);
      setError(
        caught instanceof Error
          ? caught.message
          : 'No pudimos guardar sus datos. Inténtelo de nuevo.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate aria-busy={isSubmitting}>
      <p>
        {profile.firstName} {profile.lastName} · {profile.email}
      </p>
      <CharacterizationFields
        municipalityInput={register('municipality')}
        ageRangeInput={register('ageRange')}
        populationGroupInput={register('populationGroup')}
        errors={{
          municipality: errors.municipality?.message,
          ageRange: errors.ageRange?.message,
          populationGroup: errors.populationGroup?.message,
        }}
      />
      {error && (
        <div role="alert">
          <p>{error}</p>
          {expired && <Link to={ROUTES.login}>Iniciar sesión</Link>}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

export function ProfilePage() {
  const [deleted, setDeleted] = useState(false);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let ignore = false;
    profileApi()
      .then((data) => {
        if (!ignore) {
          setProfile(data);
          setError('');
        }
      })
      .catch((caught: unknown) => {
        if (!ignore) {
          setExpired(
            caught instanceof RequestApiError && caught.status === 401,
          );
          setError(
            caught instanceof Error
              ? caught.message
              : 'No pudimos cargar su perfil.',
          );
        }
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);
  // Same text as the PageHeader while the profile is shown, so the two
  // effects never disagree; after deleting there is no PageHeader.
  useDocumentTitle(deleted ? 'Cuenta eliminada' : 'Mi perfil');
  if (deleted)
    return (
      <main className={styles.page}>
        <h1>Cuenta eliminada</h1>
        <p role="status">
          Sus datos personales se han suprimido y sus sesiones se han cerrado.
        </p>
        <Link to={ROUTES.login}>Ir al inicio de sesión</Link>
      </main>
    );
  return (
    <AppLayout>
      <section className={styles.page} aria-labelledby="profile-title">
        <PageHeader
          titleId="profile-title"
          title="Mi perfil"
          description="Consulte y actualice sus datos de caracterización."
        />
        {profile ? (
          <>
            <ProfileForm profile={profile} />
            <DeleteAccountSection onDeleted={() => setDeleted(true)} />
          </>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            {expired ? (
              <Link to={ROUTES.login}>Iniciar sesión</Link>
            ) : (
              <button
                type="button"
                onClick={() => setAttempt((current) => current + 1)}
              >
                Reintentar
              </button>
            )}
          </div>
        ) : (
          <p role="status">Cargando perfil…</p>
        )}
      </section>
    </AppLayout>
  );
}
