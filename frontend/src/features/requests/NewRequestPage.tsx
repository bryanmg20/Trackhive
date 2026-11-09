import { useState } from 'react';
import type { FormEvent } from 'react';
import { AuthLayout } from '../auth/components/AuthLayout';
import {
  createRequest,
  searchMaterials,
  type MaterialSearchResult,
} from './api/create-request';
import styles from './NewRequestPage.module.css';

export function NewRequestPage() {
  const [query, setQuery] = useState('');
  const [materials, setMaterials] = useState<MaterialSearchResult[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'PRESENCIAL' | 'DIGITAL'>(
    'PRESENCIAL',
  );
  const [searchError, setSearchError] = useState('');
  const [message, setMessage] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError('');
    setIsSearching(true);
    try {
      const results = await searchMaterials(query.trim());
      setMaterials(results);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : 'No se pudo buscar material.',
      );
    } finally {
      setIsSearching(false);
    }
  }

  function toggleMaterial(materialId: string) {
    setSelectedMaterialIds((selected) =>
      selected.includes(materialId)
        ? selected.filter((id) => id !== materialId)
        : [...selected, materialId],
    );
  }

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
            Busque y seleccione uno o más materiales. Sus datos se obtienen de
            la cuenta con la que inició sesión.
          </p>
        </header>

        <section className={styles.searchSection} aria-labelledby="search-title">
          <h2 id="search-title" className={styles.sectionTitle}>
            Materiales
          </h2>
          <form className={styles.searchForm} onSubmit={search}>
            <label htmlFor="material-query">Buscar en el archivo</label>
            <div className={styles.searchRow}>
              <input
                id="material-query"
                maxLength={100}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, autor o código"
              />
              <button type="submit" disabled={isSearching}>
                {isSearching ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </form>

          {searchError ? (
            <p className={styles.error} role="alert">
              {searchError}
            </p>
          ) : null}

          {materials.length > 0 ? (
            <fieldset className={styles.results}>
              <legend>Seleccione los materiales que desea consultar</legend>
              {materials.map((material) => (
                <label className={styles.material} key={material.id}>
                  <input
                    type="checkbox"
                    checked={selectedMaterialIds.includes(material.id)}
                    onChange={() => toggleMaterial(material.id)}
                  />
                  <span>
                    <strong>{material.title}</strong>
                    <span className={styles.materialCode}>
                      {material.catalogCode}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <p className={styles.selectionCount} aria-live="polite">
            Materiales seleccionados: {selectedMaterialIds.length}
          </p>
        </section>

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
      </main>
    </AuthLayout>
  );
}
