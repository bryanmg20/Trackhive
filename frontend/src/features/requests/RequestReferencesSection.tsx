import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  MaterialsApiError,
  searchMaterials,
} from '../materials/api/search-materials';
import type { Material } from '../materials/api/search-materials';
import { RequestsApiError } from './api/list-requests';
import {
  REFERENCE_DISPLAY_STATUS_LABELS,
  resolveReference,
} from './api/material-references';
import type { RequestReference } from './api/material-references';
import styles from './RequestReferencesSection.module.css';

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Inténtelo de nuevo.';

interface RequestReferencesSectionProps {
  requestId: string;
  references: RequestReference[];
  // Decided by the backend: only RECIBIDA or EN_BUSQUEDA (HU-09.2)
  canResolveReferences: boolean;
  // The detail and its history reload after an association
  onResolved: () => void;
}

function initialQuery(reference: RequestReference): string {
  return reference.kind === 'PROTOCOLO_NOTARIAL'
    ? (reference.notary ?? '')
    : (reference.description ?? '');
}

function errorMessage(caught: unknown): string {
  if (
    caught instanceof RequestsApiError ||
    caught instanceof MaterialsApiError
  ) {
    return caught.status === 401
      ? 'Su sesión no es válida o venció. Inicie sesión de nuevo.'
      : caught.message;
  }
  return NETWORK_ERROR_MESSAGE;
}

interface AssociatePanelProps {
  requestId: string;
  reference: RequestReference;
  onCancel: () => void;
  onResolved: () => void;
}

/** Search the catalog and associate the material of one reference (HU-09.2). */
function AssociatePanel({
  requestId,
  reference,
  onCancel,
  onResolved,
}: AssociatePanelProps) {
  const [query, setQuery] = useState(() => initialQuery(reference));
  const [results, setResults] = useState<Material[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = `reference-search-${reference.id}`;

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSearching(true);
    try {
      const page = await searchMaterials({
        q: query.trim() || undefined,
        sort: 'title',
        order: 'asc',
        page: 1,
        limit: 10,
      });
      setResults(page.items);
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setIsSearching(false);
    }
  }

  async function associate(material: Material) {
    setError(null);
    setSavingId(material.id);
    try {
      await resolveReference({
        requestId,
        referenceId: reference.id,
        materialId: material.id,
      });
      onResolved();
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setSavingId(null);
    }
  }

  return (
    <div className={styles.panel}>
      <form className={styles.search} onSubmit={(event) => void search(event)} role="search">
        <label htmlFor={inputId}>Buscar el material en el catálogo</label>
        <div className={styles.searchRow}>
          <input
            id={inputId}
            type="search"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Título, autor o código"
          />
          <button className={styles.primary} type="submit" disabled={isSearching}>
            {isSearching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {results && results.length === 0 ? (
          <p className={styles.muted}>
            No encontramos material con esa búsqueda. Si aún no se ha
            digitalizado, espere a la próxima sincronización.
          </p>
        ) : null}
        {results && results.length > 0 ? (
          <ul className={styles.results} aria-label="Materiales encontrados">
            {results.map((material) => (
              <li key={material.id} className={styles.result}>
                <span>
                  <strong>{material.title}</strong>
                  <span className={styles.muted}> · {material.catalogCode}</span>
                </span>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={savingId !== null}
                  onClick={() => void associate(material)}
                  aria-label={`Asociar ${material.title}`}
                >
                  {savingId === material.id ? 'Asociando…' : 'Asociar'}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <button type="button" className={styles.link} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}

/**
 * The written references of a request (HU-09.2): each one with its status
 * and, once resolved, its catalog material. Associating it is optional: the
 * staff may also deliver without it, explaining how in the comment.
 */
export function RequestReferencesSection({
  requestId,
  references,
  canResolveReferences,
  onResolved,
}: RequestReferencesSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const pendingCount = references.filter(
    (reference) => reference.displayStatus === 'PENDIENTE',
  ).length;

  return (
    <section className={styles.card} aria-labelledby="sec-references">
      <h2 id="sec-references" className={styles.cardTitle}>
        Referencias de material no catalogado
      </h2>
      {pendingCount > 0 ? (
        <p className={styles.notice} role="note">
          {pendingCount === 1
            ? 'Hay 1 referencia sin material asociado.'
            : `Hay ${pendingCount} referencias sin material asociado.`}{' '}
          Puede asociarle el material del catálogo cuando se digitalice, o
          pasar la solicitud a Disponible explicando en el comentario qué se
          entrega y cómo.
        </p>
      ) : null}
      <ul className={styles.list}>
        {references.map((reference) => (
          <li key={reference.id} className={styles.item}>
            <div className={styles.itemHeader}>
              <strong>{reference.label}</strong>
              <span
                className={styles.badge}
                data-status={reference.displayStatus}
              >
                {REFERENCE_DISPLAY_STATUS_LABELS[reference.displayStatus]}
              </span>
            </div>
            {reference.material ? (
              <span className={styles.muted}>
                Material asociado: {reference.material.catalogCode} ·{' '}
                {reference.material.title}
                {reference.resolvedBy ? ` — por ${reference.resolvedBy.name}` : ''}
              </span>
            ) : null}
            {reference.displayStatus === 'PENDIENTE' && canResolveReferences ? (
              openId === reference.id ? (
                <AssociatePanel
                  requestId={requestId}
                  reference={reference}
                  onCancel={() => setOpenId(null)}
                  onResolved={() => {
                    setOpenId(null);
                    onResolved();
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setOpenId(reference.id)}
                  aria-label={`Asociar material a ${reference.label}`}
                >
                  Asociar material
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
