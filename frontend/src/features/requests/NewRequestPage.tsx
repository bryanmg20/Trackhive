import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { AuthLayout } from '../auth/components/AuthLayout';
import { createRequest } from './api/create-request';
import { readMaterialIds } from './selected-materials';
import type { SelectedMaterial } from './selected-materials';
import styles from './NewRequestPage.module.css';

interface NewRequestLocationState {
  materials?: SelectedMaterial[];
}

export function NewRequestPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const selectedMaterialIds = readMaterialIds(searchParams);
  // Titles come from the search screen; a pasted URL only has the IDs
  const knownMaterials =
    (location.state as NewRequestLocationState | null)?.materials ?? [];
  const selectedMaterials = selectedMaterialIds.map(
    (id) =>
      knownMaterials.find((material) => material.id === id) ?? {
        id,
        title: 'Material seleccionado',
        catalogCode: id,
      },
  );
  const [reason, setReason] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'PRESENCIAL' | 'DIGITAL'>(
    'PRESENCIAL',
  );
  const [message, setMessage] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setTrackingCode('');
    setIsSubmitting(true);
    try {
      const result = await createRequest({
        materialIds: selectedMaterialIds,
        reason,
        desiredDate,
        deliveryMode,
      });
      setTrackingCode(result.trackingCode);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No fue posible radicar la solicitud.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout spineLabel="SOLICITUD · CONSULTA">
      <main className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Consulta documental</p>
          <h1 className={styles.title}>Radicar solicitud</h1>
          <p className={styles.intro}>
            Revise los materiales elegidos y complete la solicitud. Sus datos
            se obtienen de la cuenta con la que inició sesión.
          </p>
        </header>

        <section
          className={styles.searchSection}
          aria-labelledby="selected-title"
        >
          <h2 id="selected-title" className={styles.sectionTitle}>
            Materiales seleccionados: {selectedMaterials.length}
          </h2>
          {selectedMaterials.length > 0 ? (
            <ul className={styles.results}>
              {selectedMaterials.map((material) => (
                <li className={styles.material} key={material.id}>
                  <span>
                    <strong>{material.title}</strong>
                    <span className={styles.materialCode}>
                      {material.catalogCode}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.intro}>
              Aún no ha elegido materiales. Búsquelos en el archivo y pulse
              «Solicitar».
            </p>
          )}
          <Link className={styles.backLink} to={ROUTES.materials}>
            {selectedMaterials.length > 0
              ? 'Cambiar materiales en el buscador'
              : 'Ir al buscador de material'}
          </Link>
        </section>

        {selectedMaterials.length > 0 ? (
          <form className={styles.requestForm} onSubmit={submit}>
            <div className={styles.field}>
              <label htmlFor="request-reason">Motivo de la consulta</label>
              <textarea
                id="request-reason"
                required
                minLength={10}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="desired-date">Fecha deseada</label>
              <input
                id="desired-date"
                type="date"
                required
                value={desiredDate}
                onChange={(event) => setDesiredDate(event.target.value)}
              />
              <p className={styles.hint}>
                Elija una fecha con al menos 10 días hábiles de anticipación,
                entre lunes y sábado.
              </p>
            </div>

            <fieldset className={styles.delivery}>
              <legend>Modalidad de entrega</legend>
              <label>
                <input
                  type="radio"
                  name="delivery"
                  value="PRESENCIAL"
                  checked={deliveryMode === 'PRESENCIAL'}
                  onChange={() => setDeliveryMode('PRESENCIAL')}
                />
                Presencial
              </label>
              <label>
                <input
                  type="radio"
                  name="delivery"
                  value="DIGITAL"
                  checked={deliveryMode === 'DIGITAL'}
                  onChange={() => setDeliveryMode('DIGITAL')}
                />
                Digital
              </label>
            </fieldset>

            {message ? (
              <p className={styles.error} role="alert">
                {message}
              </p>
            ) : null}
            {trackingCode ? (
              <p className={styles.success} role="status">
                Solicitud recibida. Código de seguimiento:{' '}
                <strong>{trackingCode}</strong>
              </p>
            ) : null}

            <button
              className={styles.submit}
              type="submit"
              disabled={isSubmitting || selectedMaterialIds.length === 0}
            >
              {isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
        ) : null}
      </main>
    </AuthLayout>
  );
}
